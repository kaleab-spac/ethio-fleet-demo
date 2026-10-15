from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.fuel_request import FuelRequest
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.fuel_request import (
    FuelRequestCreate, FuelRequestDecision, FuelRequestOut,
)
from app.services.notify import audit, notify_admins, notify_driver

router = APIRouter(prefix="/api", tags=["Fuel requests"])


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


# ---------------- Driver endpoints (own data only) ----------------

@router.get("/driver/fuel-requests", response_model=list[FuelRequestOut])
def my_requests(user: User = Depends(require_driver), db: Session = Depends(get_db)):
    return db.scalars(
        select(FuelRequest)
        .where(FuelRequest.driver_id == user.driver_id)
        .order_by(FuelRequest.id.desc())
    ).all()


@router.post("/driver/fuel-requests", response_model=FuelRequestOut, status_code=201)
def create_request(
    data: FuelRequestCreate, user: User = Depends(require_driver), db: Session = Depends(get_db)
):
    vehicle = db.get(Vehicle, data.vehicle_id)
    # Same answer for "missing" and "someone else's vehicle"
    if vehicle is None or vehicle.archived or vehicle.driver_id != user.driver_id:
        raise HTTPException(status_code=403, detail="You can only request fuel for your own vehicle")

    # Duplicate protection: one open request per vehicle at a time
    existing = db.scalar(
        select(FuelRequest).where(
            FuelRequest.vehicle_id == vehicle.id, FuelRequest.status == "pending"
        )
    )
    if existing:
        raise HTTPException(
            status_code=409, detail="You already have a pending fuel request for this vehicle"
        )

    req = FuelRequest(
        driver_id=user.driver_id,
        vehicle_id=vehicle.id,
        fuel_type=data.fuel_type,
        requested_liters=data.requested_liters,
        odometer_km=data.odometer_km,
        purpose=data.purpose,
        notes=data.notes,
        status="pending",
    )
    db.add(req)
    db.flush()
    name = vehicle.name or vehicle.plate_number
    notify_admins(
        db,
        "New fuel request",
        f"{user.full_name} requests {data.requested_liters:g} L of {data.fuel_type} for {name}.",
        "/fuel-requests",
    )
    audit(db, user, "fuel_request.created", "fuel_request", req.id,
          f"{name}, {data.requested_liters:g} L")
    db.commit()
    db.refresh(req)
    return req


@router.put("/driver/fuel-requests/{request_id}/cancel", response_model=FuelRequestOut)
def cancel_request(
    request_id: int, user: User = Depends(require_driver), db: Session = Depends(get_db)
):
    req = db.get(FuelRequest, request_id)
    if req is None or req.driver_id != user.driver_id:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=409, detail="Only a pending request can be cancelled")
    req.status = "cancelled"
    audit(db, user, "fuel_request.cancelled", "fuel_request", req.id, req.vehicle_name)
    db.commit()
    db.refresh(req)
    return req


# ---------------- Manager endpoints ----------------

@router.get("/fuel-requests", response_model=list[FuelRequestOut],
            dependencies=[Depends(require_staff)])
def list_requests(
    status: str | None = None,
    driver_id: int | None = None,
    vehicle_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = select(FuelRequest).order_by(FuelRequest.id.desc())
    if status:
        query = query.where(FuelRequest.status == status)
    if driver_id is not None:
        query = query.where(FuelRequest.driver_id == driver_id)
    if vehicle_id is not None:
        query = query.where(FuelRequest.vehicle_id == vehicle_id)
    return db.scalars(query).all()


@router.put("/fuel-requests/{request_id}/decision", response_model=FuelRequestOut)
def decide(
    request_id: int,
    data: FuelRequestDecision,
    user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    req = db.get(FuelRequest, request_id)
    if req is None:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=409, detail=f"This request is already {req.status}")
    reason = (data.reason or "").strip()

    if data.decision == "rejected":
        if len(reason) < 3:
            raise HTTPException(status_code=400, detail="Please give a reason for rejecting")
        req.status = "rejected"
        req.approved_liters = None
        text = f"Your fuel request for {req.vehicle_name} was rejected. Reason: {reason}"
    else:
        liters = data.approved_liters if data.approved_liters is not None else req.requested_liters
        if liters > req.requested_liters:
            raise HTTPException(
                status_code=400, detail="Approved liters cannot be more than requested"
            )
        req.status = "approved"
        req.approved_liters = liters
        text = f"Your fuel request for {req.vehicle_name} was approved: {liters:g} L."
        if reason:
            text += f" Note: {reason}"

    req.decision_reason = reason or None
    req.reviewed_by = user.id
    req.reviewed_at = datetime.utcnow()
    notify_driver(db, req.driver_id, f"Fuel request {req.status}", text, "/driver/fuel")
    audit(db, user, f"fuel_request.{req.status}", "fuel_request", req.id,
          f"{req.driver_name}, {req.vehicle_name}: {reason or 'no note'}")
    db.commit()
    db.refresh(req)
    return req