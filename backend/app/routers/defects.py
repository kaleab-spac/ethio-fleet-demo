from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.defect import DefectComment, DefectReport
from app.models.user import User
from app.schemas.defect import (
    CommentCreate, CommentOut, DefectDetail, DefectOut, DefectStatusUpdate,
)
from app.services.defect_flow import apply_transition
from app.services.notify import audit, notify_driver

# Access rules (viewers read only, drivers blocked) are applied in main.py
router = APIRouter(prefix="/api/defects", tags=["Defects"])


@router.get("/", response_model=list[DefectOut])
def list_defects(
    status: str | None = None, severity: str | None = None, db: Session = Depends(get_db)
):
    query = select(DefectReport).order_by(DefectReport.id.desc())
    if status:
        query = query.where(DefectReport.status == status)
    if severity:
        query = query.where(DefectReport.severity == severity)
    return db.scalars(query).all()


@router.get("/{defect_id}", response_model=DefectDetail)
def get_defect(defect_id: int, db: Session = Depends(get_db)):
    report = db.get(DefectReport, defect_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Defect report not found")
    return report


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
    apply_transition(db, report, data.status, data.note, user)
    db.commit()
    db.refresh(report)
    return report


@router.post("/{defect_id}/comments", response_model=CommentOut, status_code=201)
def add_comment(
    defect_id: int,
    data: CommentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    report = db.get(DefectReport, defect_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Defect report not found")
    comment = DefectComment(
        defect_id=report.id, author_id=user.id,
        body=data.body.strip(), visible_to_driver=data.visible_to_driver,
    )
    db.add(comment)
    name = report.vehicle_name or f"vehicle {report.vehicle_id}"
    if data.visible_to_driver:
        notify_driver(
            db, report.driver_id, "New comment on your defect report",
            f"Your manager commented on the {name} report: {data.body.strip()[:300]}",
            "/driver/defects",
        )
    audit(db, user, "defect.comment", "defect", report.id,
          f"{'visible to driver' if data.visible_to_driver else 'internal'} ({name})")
    db.commit()
    db.refresh(comment)
    return comment