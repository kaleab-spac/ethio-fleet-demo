from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.fuel import FuelLog
from app.models.vehicle import Vehicle
from app.schemas.fuel import FuelCreate, FuelOut, FuelUpdate

router = APIRouter(prefix="/api/fuel", tags=["Fuel"])

# Placeholder limits for the "suspicious entry" flags. Adjust to real prices.
MIN_PRICE_ETB = 50
MAX_PRICE_ETB = 150


def compute_flags(db: Session) -> dict[int, list[str]]:
    """Review reasons for every non-rejected fuel record, keyed by record id.
    The 'previous odometer' comes from verified records only."""
    flags: dict[int, list[str]] = {}
    logs = db.scalars(
        select(FuelLog)
        .where(FuelLog.status != "rejected")
        .order_by(FuelLog.vehicle_id, FuelLog.fuel_date, FuelLog.id)
    ).all()
    previous_odometer: dict[int, float] = {}
    for log in logs:
        reasons = []
        if log.odometer_km == 0:
            reasons.append("Odometer not recorded")
        elif log.vehicle_id in previous_odometer and log.odometer_km < previous_odometer[log.vehicle_id]:
            reasons.append("Odometer is lower than the previous fill-up")
        if not (MIN_PRICE_ETB <= log.price_per_liter_etb <= MAX_PRICE_ETB):
            reasons.append(
                f"Unusual price per liter (expected {MIN_PRICE_ETB}-{MAX_PRICE_ETB} ETB)"
            )
        if reasons:
            flags[log.id] = reasons
        if log.status == "verified" and log.odometer_km > 0:
            previous_odometer[log.vehicle_id] = log.odometer_km
    return flags


def to_out(log: FuelLog, flags: dict[int, list[str]]) -> FuelOut:
    out = FuelOut.model_validate(log)
    out.flags = flags.get(log.id, [])
    return out


def check_vehicle_and_date(db: Session, vehicle_id: int, fuel_date: date):
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=400, detail="Vehicle does not exist")
    if vehicle.archived:
        raise HTTPException(status_code=400, detail="This vehicle is archived")
    if fuel_date > date.today():
        raise HTTPException(status_code=400, detail="The fuel date cannot be in the future")


def filtered_query(vehicle_id, date_from, date_to, status=None):
    query = select(FuelLog)
    if status and status != "all":
        query = query.where(FuelLog.status == status)
    if vehicle_id is not None:
        query = query.where(FuelLog.vehicle_id == vehicle_id)
    if date_from is not None:
        query = query.where(FuelLog.fuel_date >= date_from)
    if date_to is not None:
        query = query.where(FuelLog.fuel_date <= date_to)
    return query


# NOTE: "/summary" must come before any "/{id}" route
@router.get("/summary")
def fuel_summary(
    vehicle_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
):
    """Totals and cost per km. Only VERIFIED fill-ups are counted.

    Cost per km = (cost of the measured fill-ups except the earliest) / distance,
    where distance = highest odometer - lowest odometer among the measured records.
    Records with no odometer, or flagged as "odometer lower than before", are left
    out of this calculation (they still count in liters and total cost).
    Needs at least 2 measured fill-ups with different readings, otherwise null.
    """
    month_start = date.today().replace(day=1)
    flags = compute_flags(db)
    logs = db.scalars(
        filtered_query(vehicle_id, date_from, date_to, "verified").order_by(
            FuelLog.fuel_date, FuelLog.id
        )
    ).all()

    total_liters = 0.0
    total_cost = 0.0
    month_liters = 0.0
    month_cost = 0.0
    by_vehicle: dict[int, list[FuelLog]] = {}
    for log in logs:
        total_liters += log.liters
        total_cost += log.total_cost_etb
        if log.fuel_date >= month_start:
            month_liters += log.liters
            month_cost += log.total_cost_etb
        by_vehicle.setdefault(log.vehicle_id, []).append(log)

    vehicles = []
    for vid, items in by_vehicle.items():
        v_liters = sum(i.liters for i in items)
        v_cost = sum(i.total_cost_etb for i in items)
        measured = [
            i for i in items
            if i.odometer_km > 0
            and not any("lower" in reason for reason in flags.get(i.id, []))
        ]
        cost_per_km = None
        km = 0.0
        if len(measured) >= 2:
            first = min(measured, key=lambda i: i.odometer_km)
            km = max(i.odometer_km for i in measured) - first.odometer_km
            if km > 0:
                measured_cost = sum(i.total_cost_etb for i in measured)
                cost_per_km = round((measured_cost - first.total_cost_etb) / km, 2)
        vehicles.append({
            "vehicle_id": vid,
            "vehicle_name": items[0].vehicle_name,
            "fill_ups": len(items),
            "total_liters": round(v_liters, 1),
            "total_cost_etb": round(v_cost, 2),
            "distance_km": round(km, 1),
            "cost_per_km_etb": cost_per_km,
        })
    vehicles.sort(key=lambda v: v["vehicle_name"] or "")

    return {
        "total_liters": round(total_liters, 1),
        "total_cost_etb": round(total_cost, 2),
        "month_liters": round(month_liters, 1),
        "month_cost_etb": round(month_cost, 2),
        "vehicles": vehicles,
    }


@router.get("/", response_model=list[FuelOut])
def list_fuel(
    vehicle_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    status: str | None = "verified",
    db: Session = Depends(get_db),
):
    """Verified fill-ups by default. Use ?status=all to see every status."""
    flags = compute_flags(db)
    logs = db.scalars(
        filtered_query(vehicle_id, date_from, date_to, status).order_by(
            FuelLog.fuel_date.desc(), FuelLog.id.desc()
        )
    ).all()
    return [to_out(log, flags) for log in logs]


@router.post("/", response_model=FuelOut, status_code=201)
def create_fuel(data: FuelCreate, db: Session = Depends(get_db)):
    """Entered by an admin, so it is verified straight away."""
    check_vehicle_and_date(db, data.vehicle_id, data.fuel_date)
    log = FuelLog(**data.model_dump(), status="verified")
    db.add(log)
    db.commit()
    db.refresh(log)
    return to_out(log, compute_flags(db))


@router.put("/{log_id}", response_model=FuelOut)
def update_fuel(log_id: int, data: FuelUpdate, db: Session = Depends(get_db)):
    log = db.get(FuelLog, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Fuel record not found")
    changes = data.model_dump(exclude_unset=True)
    check_vehicle_and_date(
        db,
        changes.get("vehicle_id", log.vehicle_id),
        changes.get("fuel_date", log.fuel_date),
    )
    for field, value in changes.items():
        setattr(log, field, value)
    db.commit()
    db.refresh(log)
    return to_out(log, compute_flags(db))


@router.delete("/{log_id}", status_code=204)
def delete_fuel(log_id: int, db: Session = Depends(get_db)):
    log = db.get(FuelLog, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Fuel record not found")
    db.delete(log)
    db.commit()