from sqlalchemy import select
from sqlalchemy.orm import Session
from fastapi import APIRouter, Depends

from app.database import get_db
from app.models import Driver, FuelLog, Maintenance, Vehicle

router = APIRouter(prefix="/api/reports", tags=["Reports"])


def verified_fuel(db: Session):
    return db.scalars(select(FuelLog).where(FuelLog.status == "verified")).all()


@router.get("/fuel-by-month")
def fuel_by_month(db: Session = Depends(get_db)):
    """Verified fuel cost (ETB) and liters for each month, oldest first."""
    months = {}
    for log in verified_fuel(db):
        key = log.fuel_date.strftime("%Y-%m")
        m = months.setdefault(key, {"month": key, "cost_etb": 0.0, "liters": 0.0})
        m["cost_etb"] += log.total_cost_etb
        m["liters"] += log.liters
    result = sorted(months.values(), key=lambda x: x["month"])
    for m in result:
        m["cost_etb"] = round(m["cost_etb"], 2)
        m["liters"] = round(m["liters"], 1)
    return result


@router.get("/fleet-status")
def fleet_status(db: Session = Depends(get_db)):
    """Number of vehicles in each status (archived vehicles are left out)."""
    counts = {"active": 0, "idle": 0, "maintenance": 0, "offline": 0}
    for v in db.scalars(select(Vehicle).where(Vehicle.archived.is_(False))).all():
        counts[v.status] = counts.get(v.status, 0) + 1
    return [{"status": k, "count": c} for k, c in counts.items()]


@router.get("/driver-safety")
def driver_safety(db: Session = Depends(get_db)):
    """Drivers ordered from the lowest safety score to the highest."""
    drivers = db.scalars(select(Driver).order_by(Driver.safety_score, Driver.full_name)).all()
    return [{"name": d.full_name, "safety_score": d.safety_score} for d in drivers]


@router.get("/cost-by-vehicle")
def cost_by_vehicle(db: Session = Depends(get_db)):
    """Verified fuel cost + maintenance cost per vehicle (ETB), highest total first."""
    totals = {}
    for v in db.scalars(select(Vehicle).where(Vehicle.archived.is_(False))).all():
        totals[v.id] = {"vehicle": v.name or v.plate_number, "fuel_etb": 0.0, "maintenance_etb": 0.0}
    for log in verified_fuel(db):
        if log.vehicle_id in totals:
            totals[log.vehicle_id]["fuel_etb"] += log.total_cost_etb
    for rec in db.scalars(select(Maintenance)).all():
        if rec.vehicle_id in totals:
            totals[rec.vehicle_id]["maintenance_etb"] += rec.cost_etb

    result = []
    for t in totals.values():
        t["fuel_etb"] = round(t["fuel_etb"])
        t["maintenance_etb"] = round(t["maintenance_etb"])
        t["total_etb"] = t["fuel_etb"] + t["maintenance_etb"]
        if t["total_etb"] > 0:
            result.append(t)
    result.sort(key=lambda x: x["total_etb"], reverse=True)
    return result