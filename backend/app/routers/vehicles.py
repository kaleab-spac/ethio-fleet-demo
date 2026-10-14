from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.driver import Driver
from app.models.vehicle import Vehicle
from app.schemas.vehicle import VehicleCreate, VehicleOut, VehicleUpdate

router = APIRouter(prefix="/api/vehicles", tags=["Vehicles"])


def check_driver_exists(db: Session, driver_id: int | None):
    """Make sure the driver we are assigning really exists."""
    if driver_id is not None and db.get(Driver, driver_id) is None:
        raise HTTPException(status_code=400, detail="Driver does not exist")


@router.get("/", response_model=list[VehicleOut])
def list_vehicles(include_archived: bool = False, db: Session = Depends(get_db)):
    query = select(Vehicle).order_by(Vehicle.id)
    if not include_archived:
        query = query.where(Vehicle.archived.is_(False))
    return db.scalars(query).all()


@router.get("/{vehicle_id}", response_model=VehicleOut)
def get_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    return vehicle


@router.post("/", response_model=VehicleOut, status_code=201)
def create_vehicle(data: VehicleCreate, db: Session = Depends(get_db)):
    existing = db.scalar(select(Vehicle).where(Vehicle.plate_number == data.plate_number))
    if existing:
        raise HTTPException(status_code=400, detail="Plate number already exists")
    check_driver_exists(db, data.driver_id)
    vehicle = Vehicle(**data.model_dump())
    db.add(vehicle)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.put("/{vehicle_id}", response_model=VehicleOut)
def update_vehicle(vehicle_id: int, data: VehicleUpdate, db: Session = Depends(get_db)):
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    changes = data.model_dump(exclude_unset=True)
    if "driver_id" in changes:
        check_driver_exists(db, changes["driver_id"])
    for field, value in changes.items():
        setattr(vehicle, field, value)
    db.commit()
    db.refresh(vehicle)
    return vehicle


@router.delete("/{vehicle_id}", status_code=204)
def delete_vehicle(vehicle_id: int, db: Session = Depends(get_db)):
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    db.delete(vehicle)
    db.commit()