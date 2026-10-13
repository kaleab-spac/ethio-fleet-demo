from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.alert import Alert
from app.models.vehicle import Vehicle
from app.schemas.alert import AlertCreate, AlertOut

router = APIRouter(prefix="/api/alerts", tags=["Alerts"])


@router.get("/", response_model=list[AlertOut])
def list_alerts(acknowledged: bool | None = None, limit: int = 100, db: Session = Depends(get_db)):
    """Newest first. Use ?acknowledged=false to see only open alerts."""
    query = select(Alert).order_by(Alert.id.desc()).limit(limit)
    if acknowledged is not None:
        query = query.where(Alert.acknowledged == acknowledged)
    return db.scalars(query).all()


@router.post("/", response_model=AlertOut, status_code=201)
def create_alert(data: AlertCreate, db: Session = Depends(get_db)):
    if data.vehicle_id is not None and db.get(Vehicle, data.vehicle_id) is None:
        raise HTTPException(status_code=400, detail="Vehicle does not exist")
    alert = Alert(**data.model_dump())
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


@router.put("/{alert_id}/acknowledge", response_model=AlertOut)
def acknowledge_alert(alert_id: int, db: Session = Depends(get_db)):
    alert = db.get(Alert, alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    alert.acknowledged = True
    db.commit()
    db.refresh(alert)
    return alert