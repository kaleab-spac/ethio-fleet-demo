from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models.audit import AuditLog
from app.schemas.audit import AuditOut

router = APIRouter(prefix="/api/audit", tags=["Audit"], dependencies=[Depends(require_admin)])


@router.get("/", response_model=list[AuditOut])
def list_audit(
    entity_type: str | None = None, limit: int = 100, db: Session = Depends(get_db)
):
    query = select(AuditLog).order_by(AuditLog.id.desc()).limit(min(max(limit, 1), 500))
    if entity_type:
        query = query.where(AuditLog.entity_type == entity_type)
    return db.scalars(query).all()