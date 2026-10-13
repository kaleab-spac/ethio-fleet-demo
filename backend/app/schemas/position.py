from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class PositionCreate(BaseModel):
    vehicle_id: int
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    speed_kmh: float = Field(default=0.0, ge=0)
    heading: int = Field(default=0, ge=0, le=359)


class PositionOut(PositionCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    recorded_at: datetime


class LivePosition(BaseModel):
    """One vehicle with its latest position, used by the map."""
    vehicle_id: int
    name: str | None
    plate_number: str
    status: str
    driver_name: str | None
    latitude: float | None
    longitude: float | None
    speed_kmh: float | None
    heading: int | None
    recorded_at: datetime | None