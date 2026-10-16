from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.fuel import FuelLog
from app.models.fuel_request import FuelRequest
from app.models.user import User
from app.models.vehicle import Vehicle
from app.routers.fuel import compute_flags
from app.schemas.fillup import FillUpCreate, FillUpOut, FillUpReview, FillUpUpdate
from app.services.notify import audit, notify_admins, notify_driver

router = APIRouter(prefix="/api", tags=["Fill-ups"])


def require_driver(user: User = Depends(get_current_user)) -> User:
    if user.role != "driver" or user.driver_id is None:
        raise HTTPException(status_code=403, detail="Driver access only")
    return user


def require_staff(request: Request, user: User = Depends(get_current_user)) -> User:
    """Admins and viewers may read. Only admins may change anything."""
    if user.role == "driver":
        raise HTTPException(status_code=403, detail="Drivers cannot access fleet-wide data")
    if request.method != "GET" and user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def to_out(log: FuelLog, flags: dict[int, list[str]]) -> FillUpOut:
    out = FillUpOut.model_validate(log)
    out.flags = flags.get(log.id, [])
    return out


def check_duplicate(db: Session, vehicle_id, fuel_date, liters, odometer, exclude_id=0):
    dup = db.scalar(
        select(FuelLog).where(
            FuelLog.vehicle_id == vehicle_id,
            FuelLog.fuel_date == fuel_date,
            FuelLog.liters == liters,
            FuelLog.odometer_km == odometer,
            FuelLog.status != "rejected",
            FuelLog.id != exclude_id,
        )
    )
    if dup:
        raise HTTPException(status_code=409, detail="This fill-up was already submitted")


def check_request(db: Session, user: User, vehicle: Vehicle, request_id: int | None):
    if request_id is None:
        return
    req = db.get(FuelRequest, request_id)
    # Same answer for "missing" and "someone else's request"
    if req is None or req.driver_id != user.driver_id:
        raise HTTPException(status_code=403, detail="You can only link your own approved request")
    if req.vehicle_id != vehicle.id:
        raise HTTPException(status_code=400, detail="This request is for a different vehicle")
    if req.status not in ("approved", "partially_fulfilled"):
        raise HTTPException(status_code=409, detail=f"This request is {req.status}, not open for a fill-up")
    open_log = db.scalar(
        select(FuelLog).where(
            FuelLog.request_id == req.id,
            FuelLog.status.in_(["submitted", "needs_correction"]),
        )
    )
    if open_log:
        raise HTTPException(status_code=409, detail="A fill-up for this request is already waiting for review")


# ---------------- Driver endpoints (own data only) ----------------

@router.get("/driver/fill-ups", response_model=list[FillUpOut])
def my_fillups(user: User = Depends(require_driver), db: Session = Depends(get_db)):
    flags = compute_flags(db)
    logs = db.scalars(
        select(FuelLog).where(FuelLog.driver_id == user.driver_id).order_by(FuelLog.id.desc())
    ).all()
    return [to_out(log, flags) for log in logs]


@router.post("/driver/fill-ups", response_model=FillUpOut, status_code=201)
def submit_fillup(
    data: FillUpCreate, user: User = Depends(require_driver), db: Session = Depends(get_db)
):
    vehicle = db.get(Vehicle, data.vehicle_id)
    if vehicle is None or vehicle.archived or vehicle.driver_id != user.driver_id:
        raise HTTPException(status_code=403, detail="You can only record fuel for your own vehicle")
    if data.fuel_date > date.today():
        raise HTTPException(status_code=400, detail="The fuel date cannot be in the future")
    check_request(db, user, vehicle, data.request_id)
    check_duplicate(db, vehicle.id, data.fuel_date, data.liters, data.odometer_km)

    log = FuelLog(
        vehicle_id=vehicle.id,
        driver_id=user.driver_id,        # always from the login, never from the browser
        request_id=data.request_id,
        fuel_date=data.fuel_date,
        liters=data.liters,
        price_per_liter_etb=data.price_per_liter_etb,
        odometer_km=data.odometer_km,
        station=data.station,
        notes=data.notes,
        status="submitted",              # not an expense until an admin verifies it
    )
    db.add(log)
    db.flush()
    name = vehicle.name or vehicle.plate_number
    notify_admins(
        db, "Fill-up to verify",
        f"{user.full_name} recorded {data.liters:g} L for {name} ({log.total_cost_etb:,.0f} ETB).",
        "/fill-ups",
    )
    audit(db, user, "fill_up.submitted", "fill_up", log.id,
          f"{name}, {data.liters:g} L, {log.total_cost_etb:,.0f} ETB")
    db.commit()
    db.refresh(log)
    return to_out(log, compute_flags(db))


@router.put("/driver/fill-ups/{log_id}", response_model=FillUpOut)
def correct_fillup(
    log_id: int, data: FillUpUpdate, user: User = Depends(require_driver),
    db: Session = Depends(get_db),
):
    log = db.get(FuelLog, log_id)
    if log is None or log.driver_id != user.driver_id:
        raise HTTPException(status_code=404, detail="Fill-up not found")
    if log.status != "needs_correction":
        raise HTTPException(status_code=409, detail="Only a fill-up that needs correction can be changed")
    changes = data.model_dump(exclude_unset=True)
    new_date = changes.get("fuel_date", log.fuel_date)
    if new_date > date.today():
        raise HTTPException(status_code=400, detail="The fuel date cannot be in the future")
    check_duplicate(
        db, log.vehicle_id, new_date,
        changes.get("liters", log.liters),
        changes.get("odometer_km", log.odometer_km),
        exclude_id=log.id,
    )
    for field, value in changes.items():
        setattr(log, field, value)
    log.status = "submitted"
    name = log.vehicle_name or f"vehicle {log.vehicle_id}"
    notify_admins(db, "Fill-up corrected",
                  f"{user.full_name} corrected the fill-up for {name}.", "/fill-ups")
    audit(db, user, "fill_up.resubmitted", "fill_up", log.id, name)
    db.commit()
    db.refresh(log)
    return to_out(log, compute_flags(db))


# ---------------- Manager endpoints ----------------

@router.get("/fill-ups", response_model=list[FillUpOut], dependencies=[Depends(require_staff)])
def list_fillups(
    status: str | None = None,
    driver_id: int | None = None,
    vehicle_id: int | None = None,
    db: Session = Depends(get_db),
):
    """Driver-submitted fill-ups (admin-entered records are in /api/fuel)."""
    flags = compute_flags(db)
    query = select(FuelLog).where(FuelLog.driver_id.is_not(None)).order_by(FuelLog.id.desc())
    if status:
        query = query.where(FuelLog.status == status)
    if driver_id is not None:
        query = query.where(FuelLog.driver_id == driver_id)
    if vehicle_id is not None:
        query = query.where(FuelLog.vehicle_id == vehicle_id)
    return [to_out(log, flags) for log in db.scalars(query).all()]


LABELS = {"verified": "verified", "needs_correction": "sent back for correction", "rejected": "rejected"}


@router.put("/fill-ups/{log_id}/review", response_model=FillUpOut)
def review_fillup(
    log_id: int, data: FillUpReview, user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    log = db.get(FuelLog, log_id)
    if log is None or log.driver_id is None:
        raise HTTPException(status_code=404, detail="Fill-up not found")
    if log.status != "submitted":
        raise HTTPException(status_code=409, detail=f"This fill-up is already {log.status}")
    reason = (data.reason or "").strip()
    if data.decision != "verified" and len(reason) < 3:
        raise HTTPException(status_code=400, detail="Please give a reason")

    log.status = data.decision
    log.review_reason = reason or None
    log.reviewed_by = user.id
    log.reviewed_at = datetime.utcnow()
    name = log.vehicle_name or f"vehicle {log.vehicle_id}"

    if data.decision == "verified" and log.request_id:
        req = db.get(FuelRequest, log.request_id)
        if req:
            db.flush()  # autoflush is off, so save the new status before summing
            total = db.scalar(
                select(func.coalesce(func.sum(FuelLog.liters), 0.0)).where(
                    FuelLog.request_id == req.id, FuelLog.status == "verified"
                )
            )
            approved = req.approved_liters or req.requested_liters
            req.status = "fulfilled" if total >= approved else "partially_fulfilled"

    text = f"Your fill-up for {name} was {LABELS[data.decision]}."
    if reason:
        text += f" Note: {reason}"
    notify_driver(db, log.driver_id, f"Fill-up {LABELS[data.decision]}", text, "/driver/fuel")
    audit(db, user, f"fill_up.{data.decision}", "fill_up", log.id,
          f"{log.driver_name}, {name}: {reason or 'no note'}")
    db.commit()
    db.refresh(log)
    return to_out(log, compute_flags(db))