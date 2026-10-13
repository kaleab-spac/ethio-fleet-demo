from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.geofence import Geofence
from app.schemas.geofence import GeofenceCreate, GeofenceOut, GeofenceUpdate

router = APIRouter(prefix="/api/geofences", tags=["Geofences"])


@router.get("/", response_model=list[GeofenceOut])
def list_geofences(db: Session = Depends(get_db)):
    return db.scalars(select(Geofence).order_by(Geofence.id)).all()


@router.post("/", response_model=GeofenceOut, status_code=201)
def create_geofence(data: GeofenceCreate, db: Session = Depends(get_db)):
    geofence = Geofence(**data.model_dump())
    db.add(geofence)
    db.commit()
    db.refresh(geofence)
    return geofence


@router.put("/{geofence_id}", response_model=GeofenceOut)
def update_geofence(geofence_id: int, data: GeofenceUpdate, db: Session = Depends(get_db)):
    geofence = db.get(Geofence, geofence_id)
    if geofence is None:
        raise HTTPException(status_code=404, detail="Geofence not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(geofence, field, value)
    db.commit()
    db.refresh(geofence)
    return geofence


@router.delete("/{geofence_id}", status_code=204)
def delete_geofence(geofence_id: int, db: Session = Depends(get_db)):
    geofence = db.get(Geofence, geofence_id)
    if geofence is None:
        raise HTTPException(status_code=404, detail="Geofence not found")
    db.delete(geofence)
    db.commit()