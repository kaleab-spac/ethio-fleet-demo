from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class GeofenceCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    radius_m: float = Field(gt=0, le=100000)
    active: bool = True


class GeofenceUpdate(BaseModel):
    name: str | None = None
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    radius_m: float | None = Field(default=None, gt=0, le=100000)
    active: bool | None = None


class GeofenceOut(GeofenceCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime