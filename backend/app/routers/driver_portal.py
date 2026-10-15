from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.driver import Driver
from app.models.user import User
from app.models.vehicle import Vehicle
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