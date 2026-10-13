from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.position import Position
from app.models.vehicle import Vehicle
from app.schemas.position import LivePosition, PositionCreate, PositionOut

router = APIRouter(prefix="/api/positions", tags=["Positions"])


@router.post("/", response_model=PositionOut, status_code=201)
def add_position(data: PositionCreate, db: Session = Depends(get_db)):
    if db.get(Vehicle, data.vehicle_id) is None:
        raise HTTPException(status_code=400, detail="Vehicle does not exist")
    position = Position(**data.model_dump())
    db.add(position)
    db.commit()
    db.refresh(position)
    return position


@router.get("/live", response_model=list[LivePosition])
def live_positions(db: Session = Depends(get_db)):
    """Latest known position of every vehicle."""
    latest_ids = (
        select(func.max(Position.id)).group_by(Position.vehicle_id).scalar_subquery()
    )
    latest = {
        p.vehicle_id: p
        for p in db.scalars(select(Position).where(Position.id.in_(latest_ids))).all()
    }

    result = []
    for v in db.scalars(select(Vehicle).order_by(Vehicle.id)).all():
        p = latest.get(v.id)
        result.append(
            LivePosition(
                vehicle_id=v.id,
                name=v.name,
                plate_number=v.plate_number,
                status=v.status,
                driver_name=v.driver.full_name if v.driver else None,
                latitude=p.latitude if p else None,
                longitude=p.longitude if p else None,
                speed_kmh=p.speed_kmh if p else None,
                heading=p.heading if p else None,
                recorded_at=p.recorded_at if p else None,
            )
        )
    return result


@router.get("/history/{vehicle_id}", response_model=list[PositionOut])
def position_history(vehicle_id: int, limit: int = 100, db: Session = Depends(get_db)):
    return db.scalars(
        select(Position)
        .where(Position.vehicle_id == vehicle_id)
        .order_by(Position.id.desc())
        .limit(limit)
    ).all()