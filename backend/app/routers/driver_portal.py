from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.alert import Alert
from app.models.defect import DefectHistory, DefectReport
from app.models.driver import Driver
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.defect import DefectCreate, DefectDetail, DefectOut
from app.schemas.driver import DriverOut
from app.schemas.vehicle import VehicleOut
from app.services.notify import audit, notify_admins


def require_driver(user: User = Depends(get_current_user)) -> User:
    """Only logged-in drivers who are linked to a driver record."""
    if user.role != "driver" or user.driver_id is None:
        raise HTTPException(status_code=403, detail="Driver access only")
    return user


router = APIRouter(
    prefix="/api/driver", tags=["Driver portal"], dependencies=[Depends(require_driver)]
)


# The driver id always comes from the login token, never from the URL,
# so a driver cannot ask for someone else's data.
@router.get("/profile", response_model=DriverOut)
def my_profile(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    driver = db.get(Driver, user.driver_id)
    if driver is None:
        raise HTTPException(status_code=404, detail="Driver record not found")
    return driver


@router.get("/vehicles", response_model=list[VehicleOut])
def my_vehicles(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(Vehicle).where(
            Vehicle.driver_id == user.driver_id, Vehicle.archived.is_(False)
        )
    ).all()


@router.get("/defects", response_model=list[DefectOut])
def my_defects(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.scalars(
        select(DefectReport)
        .where(DefectReport.driver_id == user.driver_id)
        .order_by(DefectReport.id.desc())
    ).all()


@router.get("/defects/{defect_id}", response_model=DefectDetail)
def my_defect_detail(
    defect_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    report = db.get(DefectReport, defect_id)
    # Same answer for "missing" and "someone else's report"
    if report is None or report.driver_id != user.driver_id:
        raise HTTPException(status_code=404, detail="Defect report not found")
    detail = DefectDetail.model_validate(report)
    # Internal notes are never shown to drivers
    detail.comments = [c for c in detail.comments if c.visible_to_driver]
    return detail


@router.post("/defects", response_model=DefectOut, status_code=201)
def report_defect(
    data: DefectCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    vehicle = db.get(Vehicle, data.vehicle_id)
    # Same answer whether the vehicle is missing or belongs to someone else
    if vehicle is None or vehicle.archived or vehicle.driver_id != user.driver_id:
        raise HTTPException(status_code=403, detail="You can only report on your own vehicle")

    report = DefectReport(
        vehicle_id=vehicle.id,
        driver_id=user.driver_id,
        description=data.description,
        severity=data.severity,
        category=data.category,
        odometer_km=data.odometer_km,
    )
    db.add(report)
    db.flush()  # gives the report an id
    db.add(DefectHistory(
        defect_id=report.id, actor_id=user.id, from_status=None, to_status="open",
    ))

    name = vehicle.name or vehicle.plate_number
    critical = data.severity == "critical"
    db.add(Alert(
        vehicle_id=vehicle.id,
        alert_type="defect",
        severity="high" if data.severity in ("high", "critical") else data.severity,
        message=(
            f"{'CRITICAL: ' if critical else ''}{user.full_name} reported a defect on "
            f"{name}: {data.description[:150]}"
        ),
    ))
    notify_admins(
        db,
        "CRITICAL defect report" if critical else f"New {data.severity} defect report",
        f"{user.full_name} reported a defect on {name}: {data.description[:200]}",
        "/defects",
    )
    audit(db, user, "defect.reported", "defect", report.id,
          f"{name}, severity {data.severity}")

    # A critical defect takes the vehicle out of service until a manager clears it.
    # Resolving the defect does NOT put it back to active; an admin does that on purpose.
    if critical and vehicle.status != "maintenance":
        old = vehicle.status
        vehicle.status = "maintenance"
        audit(db, user, "vehicle.flagged_unsafe", "vehicle", vehicle.id,
              f"{name}: {old} -> maintenance (critical defect #{report.id})")

    db.commit()
    db.refresh(report)
    return report