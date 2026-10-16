from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.defect import DefectReport
from app.models.maintenance import Maintenance
from app.models.maintenance_request import MaintenanceRequest
from app.models.user import User
from app.models.vehicle import Vehicle
from app.schemas.maintenance_request import (
    LinkDefect, MaintReqAction, MaintReqCreate, MaintReqOut,
)
from app.services.notify import audit, notify_admins, notify_driver

router = APIRouter(prefix="/api", tags=["Maintenance requests"])

OPEN_STATUSES = ("pending", "approved", "scheduled", "in_progress")

# Name used in the service history (so the reminders match by service type)
SERVICE_TYPE = {
    "oil_change": "Oil change",
    "brakes": "Brake service",
    "tires": "Tire rotation",
    "engine": "Engine service",
    "electrical": "Electrical repair",
    "body": "Body repair",
    "inspection": "Annual inspection (Bolo)",
    "other": "Other service",
}

# action -> (statuses it may start from, status it leads to)
ACTIONS = {
    "approve": ({"pending"}, "approved"),
    "reject": ({"pending"}, "rejected"),
    "schedule": ({"pending", "approved"}, "scheduled"),
    "start": ({"scheduled"}, "in_progress"),
    "complete": ({"in_progress"}, "completed"),
    "cancel": ({"pending", "approved", "scheduled"}, "cancelled"),
}


def require_driver(user: User = Depends(get_current_user)) -> User:
    if user.role != "driver" or user.driver_id is None:
        raise HTTPException(status_code=403, detail="Driver access only")
    return user


def require_staff(request: Request, user: User = Depends(get_current_user)) -> User:
    """Admins and viewers may read. Only admins may change anything."""
    if user.role == "driver":
        raise HTTPException(status_code=403, detail="Drivers cannot access fleet-wide data")
    if request.method != "GET" and user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


def defect_is_free(db: Session, defect_id: int, except_request_id: int = 0):
    other = db.scalar(
        select(MaintenanceRequest).where(
            MaintenanceRequest.defect_id == defect_id,
            MaintenanceRequest.status.in_(OPEN_STATUSES),
            MaintenanceRequest.id != except_request_id,
        )
    )
    if other:
        raise HTTPException(
            status_code=409,
            detail=f"This defect is already linked to maintenance request #{other.id}",
        )


# ---------------- Driver endpoints (own data only) ----------------

@router.get("/driver/maintenance-requests", response_model=list[MaintReqOut])
def my_requests(user: User = Depends(require_driver), db: Session = Depends(get_db)):
    return db.scalars(
        select(MaintenanceRequest)
        .where(MaintenanceRequest.driver_id == user.driver_id)
        .order_by(MaintenanceRequest.id.desc())
    ).all()


@router.post("/driver/maintenance-requests", response_model=MaintReqOut, status_code=201)
def create_request(
    data: MaintReqCreate, user: User = Depends(require_driver), db: Session = Depends(get_db)
):
    vehicle = db.get(Vehicle, data.vehicle_id)
    # Same answer for "missing" and "someone else's vehicle"
    if vehicle is None or vehicle.archived or vehicle.driver_id != user.driver_id:
        raise HTTPException(status_code=403, detail="You can only request maintenance for your own vehicle")
    if data.preferred_date is not None and data.preferred_date < date.today():
        raise HTTPException(status_code=400, detail="The preferred date cannot be in the past")

    # Duplicate protection: one pending request per vehicle and category
    existing = db.scalar(
        select(MaintenanceRequest).where(
            MaintenanceRequest.vehicle_id == vehicle.id,
            MaintenanceRequest.category == data.category,
            MaintenanceRequest.status == "pending",
        )
    )
    if existing:
        raise HTTPException(
            status_code=409,
            detail="You already have a pending request of this type for this vehicle",
        )

    if data.defect_id is not None:
        defect = db.get(DefectReport, data.defect_id)
        if defect is None or defect.driver_id != user.driver_id or defect.vehicle_id != vehicle.id:
            raise HTTPException(status_code=403, detail="You can only link your own defect report")
        defect_is_free(db, defect.id)

    req = MaintenanceRequest(
        driver_id=user.driver_id,
        vehicle_id=vehicle.id,
        category=data.category,
        description=data.description,
        urgency=data.urgency,
        odometer_km=data.odometer_km,
        preferred_date=data.preferred_date,
        notes=data.notes,
        defect_id=data.defect_id,
        status="pending",
    )
    db.add(req)
    db.flush()
    name = vehicle.name or vehicle.plate_number
    urgent = data.urgency == "urgent"
    notify_admins(
        db,
        "URGENT maintenance request" if urgent else "New maintenance request",
        f"{user.full_name} requests {SERVICE_TYPE[data.category].lower()} for {name}: {data.description[:200]}",
        "/maintenance-requests",
    )
    audit(db, user, "maintenance_request.created", "maintenance_request", req.id,
          f"{name}, {data.category}, urgency {data.urgency}")
    db.commit()
    db.refresh(req)
    return req


@router.put("/driver/maintenance-requests/{request_id}/cancel", response_model=MaintReqOut)
def cancel_own(
    request_id: int, user: User = Depends(require_driver), db: Session = Depends(get_db)
):
    req = db.get(MaintenanceRequest, request_id)
    if req is None or req.driver_id != user.driver_id:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status != "pending":
        raise HTTPException(status_code=409, detail="Only a pending request can be cancelled")
    req.status = "cancelled"
    audit(db, user, "maintenance_request.cancelled", "maintenance_request", req.id, req.vehicle_name)
    db.commit()
    db.refresh(req)
    return req


# ---------------- Manager endpoints ----------------

@router.get("/maintenance-requests", response_model=list[MaintReqOut],
            dependencies=[Depends(require_staff)])
def list_requests(
    status: str | None = None,
    urgency: str | None = None,
    driver_id: int | None = None,
    vehicle_id: int | None = None,
    db: Session = Depends(get_db),
):
    query = select(MaintenanceRequest).order_by(MaintenanceRequest.id.desc())
    if status:
        query = query.where(MaintenanceRequest.status == status)
    if urgency:
        query = query.where(MaintenanceRequest.urgency == urgency)
    if driver_id is not None:
        query = query.where(MaintenanceRequest.driver_id == driver_id)
    if vehicle_id is not None:
        query = query.where(MaintenanceRequest.vehicle_id == vehicle_id)
    return db.scalars(query).all()


@router.put("/maintenance-requests/{request_id}/action", response_model=MaintReqOut)
def act(
    request_id: int,
    data: MaintReqAction,
    user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    req = db.get(MaintenanceRequest, request_id)
    if req is None:
        raise HTTPException(status_code=404, detail="Request not found")

    allowed_from, new_status = ACTIONS[data.action]
    if req.status not in allowed_from:
        raise HTTPException(
            status_code=409,
            detail=f"A request that is {req.status.replace('_', ' ')} cannot be {data.action}d"
            if data.action != "start" else
            f"A request that is {req.status.replace('_', ' ')} cannot be started",
        )

    reason = (data.reason or "").strip()
    name = req.vehicle_name or f"vehicle {req.vehicle_id}"
    text = None

    if data.action in ("reject", "cancel"):
        if len(reason) < 3:
            raise HTTPException(status_code=400, detail="Please give a reason")
        req.decision_reason = reason
        text = f"Your maintenance request for {name} was {new_status}. Reason: {reason}"

    elif data.action == "approve":
        if reason:
            req.decision_reason = reason
        text = f"Your maintenance request for {name} was approved."
        if reason:
            text += f" Note: {reason}"

    elif data.action == "schedule":
        if data.scheduled_date is None:
            raise HTTPException(status_code=400, detail="Please choose the service date")
        if data.scheduled_date < date.today():
            raise HTTPException(status_code=400, detail="The service date cannot be in the past")
        provider = (data.provider or "").strip()
        if len(provider) < 2:
            raise HTTPException(status_code=400, detail="Please enter the technician or service provider")
        req.scheduled_date = data.scheduled_date
        req.provider = provider
        if reason:
            req.decision_reason = reason
        text = (f"Maintenance for {name} is scheduled for {data.scheduled_date} "
                f"with {provider}.")
        if reason:
            text += f" Instructions: {reason}"

    elif data.action == "start":
        text = f"Maintenance on {name} has started."

    elif data.action == "complete":
        if data.cost_etb is None:
            raise HTTPException(status_code=400, detail="Please enter the cost (0 if free)")
        if len(reason) < 3:
            raise HTTPException(status_code=400, detail="Please describe the work done")
        if data.next_due_date is not None and data.next_due_date < date.today():
            raise HTTPException(status_code=400, detail="The next due date cannot be in the past")
        record = Maintenance(
            vehicle_id=req.vehicle_id,
            service_type=SERVICE_TYPE[req.category],
            description=reason,
            service_date=date.today(),
            odometer_km=data.odometer_km if data.odometer_km is not None else req.odometer_km,
            cost_etb=data.cost_etb,
            next_due_date=data.next_due_date,
            next_due_odometer_km=data.next_due_odometer_km,
        )
        db.add(record)
        db.flush()
        req.maintenance_id = record.id
        req.completed_at = datetime.utcnow()
        text = (f"Maintenance on {name} is complete: {reason}. "
                "Your manager will confirm when the vehicle is available.")

    req.status = new_status
    req.reviewed_by = user.id
    req.reviewed_at = datetime.utcnow()
    notify_driver(db, req.driver_id, f"Maintenance request {new_status.replace('_', ' ')}",
                  text, "/driver/maintenance")
    audit(db, user, f"maintenance_request.{new_status}", "maintenance_request", req.id,
          f"{req.driver_name}, {name}: {reason or 'no note'}")
    db.commit()
    db.refresh(req)
    return req


@router.put("/maintenance-requests/{request_id}/link-defect", response_model=MaintReqOut)
def link_defect(
    request_id: int,
    data: LinkDefect,
    user: User = Depends(require_staff),
    db: Session = Depends(get_db),
):
    req = db.get(MaintenanceRequest, request_id)
    if req is None:
        raise HTTPException(status_code=404, detail="Request not found")
    if req.status not in OPEN_STATUSES:
        raise HTTPException(status_code=409, detail="This request is already closed")
    if data.defect_id is not None:
        defect = db.get(DefectReport, data.defect_id)
        if defect is None:
            raise HTTPException(status_code=404, detail="Defect report not found")
        if defect.vehicle_id != req.vehicle_id:
            raise HTTPException(status_code=400, detail="The defect is for a different vehicle")
        defect_is_free(db, defect.id, except_request_id=req.id)
    req.defect_id = data.defect_id
    audit(db, user, "maintenance_request.defect_linked", "maintenance_request", req.id,
          f"defect #{data.defect_id}" if data.defect_id else "link removed")
    db.commit()
    db.refresh(req)
    return req