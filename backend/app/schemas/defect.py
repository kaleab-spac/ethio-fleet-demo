from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Category = Literal["brakes", "engine", "tires", "electrical", "body", "steering", "other"]


class DefectCreate(BaseModel):
    vehicle_id: int
    description: str = Field(min_length=5, max_length=500)
    severity: Literal["low", "medium", "high", "critical"] = "medium"
    category: Category | None = None
    odometer_km: float | None = Field(default=None, ge=0)


class DefectStatusUpdate(BaseModel):
    status: Literal["acknowledged", "in_progress", "resolved", "closed", "rejected"]
    note: str | None = Field(default=None, max_length=500)


class CommentCreate(BaseModel):
    body: str = Field(min_length=2, max_length=500)
    visible_to_driver: bool = True


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    author_name: str | None = None
    body: str
    visible_to_driver: bool
    created_at: datetime


class HistoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actor_name: str | None = None
    from_status: str | None = None
    to_status: str
    note: str | None = None
    created_at: datetime


class DefectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vehicle_id: int
    vehicle_name: str | None = None
    driver_id: int
    driver_name: str | None = None
    description: str
    severity: str
    status: str
    category: str | None = None
    odometer_km: float | None = None
    resolution: str | None = None
    created_at: datetime
    updated_at: datetime | None = None


class DefectDetail(DefectOut):
    comments: list[CommentOut] = []
    history: list[HistoryOut] = []