from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.maintenance import Maintenance
from app.models.vehicle import Vehicle
from app.schemas.maintenance import MaintenanceCreate, MaintenanceOut, MaintenanceUpdate

router = APIRouter(prefix="/api/maintenance", tags=["Maintenance"])

SOON_DAYS = 30
SOON_KM = 1000


def check_record(db: Session, vehicle_id: int, service_date: date,
                 next_due_date: date | None, check_archived: bool):
    vehicle = db.get(Vehicle, vehicle_id)
    if vehicle is None:
        raise HTTPException(status_code=400, detail="Vehicle does not exist")
    if check_archived and vehicle.archived:
        raise HTTPException(status_code=400, detail="This vehicle is archived")
    if service_date > date.today():
        raise HTTPException(status_code=400, detail="The service date cannot be in the future")
    if next_due_date is not None and next_due_date < service_date:
        raise HTTPException(status_code=400, detail="The next due date cannot be before the service date")


# NOTE: this route must come before "/{record_id}" routes
@router.get("/reminders")
def reminders(vehicle_id: int | None = None, db: Session = Depends(get_db)):
    """Services that are overdue or due soon (latest record per vehicle + service type)."""
    today = date.today()
    records = db.scalars(
        select(Maintenance).order_by(Maintenance.service_date, Maintenance.id)
    ).all()

    # Keep only the newest record for each (vehicle, service type)
    latest = {}
    for r in records:
        latest[(r.vehicle_id, r.service_type)] = r

    result = []
    for r in latest.values():
        if vehicle_id is not None and r.vehicle_id != vehicle_id:
            continue
        vehicle = db.get(Vehicle, r.vehicle_id)
        if vehicle is None or vehicle.archived:
            continue
        odometer = vehicle.odometer_km
        status = None
        reason = None

        if r.next_due_date is not None:
            days_left = (r.next_due_date - today).days
            if days_left < 0:
                status, reason = "overdue", f"Overdue by {-days_left} days"
            elif days_left <= SOON_DAYS:
                status, reason = "due_soon", f"Due in {days_left} days"

        if r.next_due_odometer_km is not None:
            km_left = r.next_due_odometer_km - odometer
            if km_left < 0:
                status, reason = "overdue", f"Overdue by {round(-km_left):,} km"
            elif km_left <= SOON_KM and status != "overdue":
                status, reason = "due_soon", f"Due in {round(km_left):,} km"

        if status:
            result.append({
                "id": r.id,
                "vehicle_id": r.vehicle_id,
                "vehicle_name": r.vehicle_name,
                "service_type": r.service_type,
                "next_due_date": r.next_due_date,
                "next_due_odometer_km": r.next_due_odometer_km,
                "status": status,
                "reason": reason,
            })

    # Overdue first
    result.sort(key=lambda x: (x["status"] != "overdue", x["vehicle_name"] or ""))
    return result


@router.get("/", response_model=list[MaintenanceOut])
def list_maintenance(
    vehicle_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    db: Session = Depends(get_db),
):
    """Newest service first. Optional filters: vehicle and service date range."""
    query = select(Maintenance).order_by(Maintenance.service_date.desc(), Maintenance.id.desc())
    if vehicle_id is not None:
        query = query.where(Maintenance.vehicle_id == vehicle_id)
    if date_from is not None:
        query = query.where(Maintenance.service_date >= date_from)
    if date_to is not None:
        query = query.where(Maintenance.service_date <= date_to)
    return db.scalars(query).all()


@router.post("/", response_model=MaintenanceOut, status_code=201)
def create_maintenance(data: MaintenanceCreate, db: Session = Depends(get_db)):
    check_record(db, data.vehicle_id, data.service_date, data.next_due_date, check_archived=True)
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
    changes = data.model_dump(exclude_unset=True)
    check_record(
        db,
        record.vehicle_id,
        changes.get("service_date", record.service_date),
        changes["next_due_date"] if "next_due_date" in changes else record.next_due_date,
        check_archived=False,
    )
    for field, value in changes.items():
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