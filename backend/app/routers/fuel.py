from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.fuel import FuelLog
from app.models.vehicle import Vehicle
from app.schemas.fuel import FuelCreate, FuelOut

router = APIRouter(prefix="/api/fuel", tags=["Fuel"])


# NOTE: "/summary" must come before any "/{id}" route
@router.get("/summary")
def fuel_summary(db: Session = Depends(get_db)):
    """Fuel totals for this month and cost per km for each vehicle."""
    today = date.today()
    month_start = today.replace(day=1)
    logs = db.scalars(select(FuelLog).order_by(FuelLog.fuel_date, FuelLog.id)).all()

    month_liters = 0.0
    month_cost = 0.0
    by_vehicle = {}
    for log in logs:
        if log.fuel_date >= month_start:
            month_liters += log.liters
            month_cost += log.total_cost_etb
        by_vehicle.setdefault(log.vehicle_id, []).append(log)

    vehicles = []
    for vid, items in by_vehicle.items():
        total_liters = sum(i.liters for i in items)
        total_cost = sum(i.total_cost_etb for i in items)
        # Distance between first and last odometer reading
        km = max(i.odometer_km for i in items) - min(i.odometer_km for i in items)
        vehicles.append({
            "vehicle_id": vid,
            "vehicle_name": items[0].vehicle_name,
            "fill_ups": len(items),
            "total_liters": round(total_liters, 1),
            "total_cost_etb": round(total_cost, 2),
            "distance_km": round(km, 1),
            "cost_per_km_etb": round(total_cost / km, 2) if km > 0 else None,
        })
    vehicles.sort(key=lambda v: v["vehicle_name"] or "")

    return {
        "month_liters": round(month_liters, 1),
        "month_cost_etb": round(month_cost, 2),
        "vehicles": vehicles,
    }


@router.get("/", response_model=list[FuelOut])
def list_fuel(vehicle_id: int | None = None, db: Session = Depends(get_db)):
    query = select(FuelLog).order_by(FuelLog.fuel_date.desc(), FuelLog.id.desc())
    if vehicle_id is not None:
        query = query.where(FuelLog.vehicle_id == vehicle_id)
    return db.scalars(query).all()


@router.post("/", response_model=FuelOut, status_code=201)
def create_fuel(data: FuelCreate, db: Session = Depends(get_db)):
    if db.get(Vehicle, data.vehicle_id) is None:
        raise HTTPException(status_code=400, detail="Vehicle does not exist")
    log = FuelLog(**data.model_dump())
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.delete("/{log_id}", status_code=204)
def delete_fuel(log_id: int, db: Session = Depends(get_db)):
    log = db.get(FuelLog, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Fuel record not found")
    db.delete(log)
    db.commit()