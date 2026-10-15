from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.defect import DefectReport
from app.schemas.defect import DefectOut, DefectStatusUpdate

# Access rules (viewers read only, drivers blocked) are applied in main.py
router = APIRouter(prefix="/api/defects", tags=["Defects"])


@router.get("/", response_model=list[DefectOut])
def list_defects(status: str | None = None, db: Session = Depends(get_db)):
    query = select(DefectReport).order_by(DefectReport.id.desc())
    if status:
        query = query.where(DefectReport.status == status)
    return db.scalars(query).all()


@router.put("/{defect_id}/status", response_model=DefectOut)
def update_status(defect_id: int, data: DefectStatusUpdate, db: Session = Depends(get_db)):
    report = db.get(DefectReport, defect_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Defect report not found")
    report.status = data.status
    db.commit()
    db.refresh(report)
    return report