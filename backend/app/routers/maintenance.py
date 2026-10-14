from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.maintenance import Maintenance
from app.models.vehicle import Vehicle
from app.schemas.maintenance import MaintenanceCreate, MaintenanceOut, MaintenanceUpdate

router = APIRouter(prefix="/api/maintenance", tags=["Maintenance"])


@router.get("/", response_model=list[MaintenanceOut])
def list_maintenance(vehicle_id: int | None = None, db: Session = Depends(get_db)):
    """Newest service first. Use ?vehicle_id=2 to see one vehicle."""
    query = select(Maintenance).order_by(Maintenance.service_date.desc(), Maintenance.id.desc())
    if vehicle_id is not None:
        query = query.where(Maintenance.vehicle_id == vehicle_id)
    return db.scalars(query).all()


@router.post("/", response_model=MaintenanceOut, status_code=201)
def create_maintenance(data: MaintenanceCreate, db: Session = Depends(get_db)):
    if db.get(Vehicle, data.vehicle_id) is None:
        raise HTTPException(status_code=400, detail="Vehicle does not exist")
    record = Maintenance(**data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


@router.put("/{record_id}", response_model=MaintenanceOut)
def update_maintenance(record_id: int, data: MaintenanceUpdate, db: Session = Depends(get_db)):
    record = db.get(Maintenance, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(record, field, value)
    db.commit()
    db.refresh(record)
    return record


@router.delete("/{record_id}", status_code=204)
def delete_maintenance(record_id: int, db: Session = Depends(get_db)):
    record = db.get(Maintenance, record_id)
    if record is None:
        raise HTTPException(status_code=404, detail="Maintenance record not found")
    db.delete(record)
    db.commit()