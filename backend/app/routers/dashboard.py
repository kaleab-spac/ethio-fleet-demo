from datetime import date, timedelta

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.driver import Driver
from app.models.vehicle import Vehicle

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/summary")
def dashboard_summary(db: Session = Depends(get_db)):
    today = date.today()
    soon = today + timedelta(days=60)

    # Count vehicles grouped by status
    rows = db.execute(select(Vehicle.status, func.count()).group_by(Vehicle.status)).all()
    by_status = {status: count for status, count in rows}

    total_vehicles = sum(by_status.values())
    total_drivers = db.scalar(select(func.count()).select_from(Driver))

    unassigned = db.scalar(
        select(func.count()).select_from(Vehicle).where(Vehicle.driver_id.is_(None))
    )
    expired = db.scalar(
        select(func.count()).select_from(Driver).where(Driver.license_expiry < today)
    )
    expiring_soon = db.scalar(
        select(func.count())
        .select_from(Driver)
        .where(Driver.license_expiry >= today, Driver.license_expiry <= soon)
    )
    low_safety = db.scalar(
        select(func.count()).select_from(Driver).where(Driver.safety_score < 70)
    )

    return {
        "vehicles": {
            "total": total_vehicles,
            "active": by_status.get("active", 0),
            "idle": by_status.get("idle", 0),
            "maintenance": by_status.get("maintenance", 0),
            "offline": by_status.get("offline", 0),
            "unassigned": unassigned,
        },
        "drivers": {
            "total": total_drivers,
            "licenses_expired": expired,
            "licenses_expiring_60_days": expiring_soon,
            "low_safety_score": low_safety,
        },
    }