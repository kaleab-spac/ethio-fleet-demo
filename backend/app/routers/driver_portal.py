from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.alert import Alert
from app.models.defect import DefectReport
from app.models.driver import Driver
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.defect import DefectCreate, DefectOut
from app.schemas.driver import DriverOut
from app.schemas.vehicle import VehicleOut


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
    )
    db.add(report)
    # Tell the manager through the normal alerts list
    name = vehicle.name or vehicle.plate_number
    db.add(Alert(
        vehicle_id=vehicle.id,
        alert_type="defect",
        severity=data.severity,
        message=f"{user.full_name} reported a defect on {name}: {data.description[:150]}",
    ))
    db.commit()
    db.refresh(report)
    return report