from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.defect import DefectReport
from app.models.user import User
from app.schemas.defect import DefectOut, DefectStatusUpdate
from app.services.notify import audit, notify_driver

# Access rules (viewers read only, drivers blocked) are applied in main.py
router = APIRouter(prefix="/api/defects", tags=["Defects"])


@router.get("/", response_model=list[DefectOut])
def list_defects(status: str | None = None, db: Session = Depends(get_db)):
    query = select(DefectReport).order_by(DefectReport.id.desc())
    if status:
        query = query.where(DefectReport.status == status)
    return db.scalars(query).all()


@router.put("/{defect_id}/status", response_model=DefectOut)
def update_status(
    defect_id: int,
    data: DefectStatusUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = db.get(DefectReport, defect_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Defect report not found")
    old = report.status
    if old == data.status:
        return report
    report.status = data.status
    name = report.vehicle_name or f"vehicle {report.vehicle_id}"
    # One commit: the change, the notification and the audit entry succeed or fail together
    notify_driver(
        db, report.driver_id,
        "Defect report updated",
        f"Your defect report on {name} is now: {data.status.replace('_', ' ')}.",
        "/driver/defects",
    )
    audit(
        db, user, "defect.status_changed", "defect", report.id,
        f"{old} -> {data.status} ({name})",
    )
    db.commit()
    db.refresh(report)
    return report