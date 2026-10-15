from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class DefectCreate(BaseModel):
    vehicle_id: int
    description: str = Field(min_length=5, max_length=500)
    severity: Literal["low", "medium", "high"] = "medium"


class DefectStatusUpdate(BaseModel):
    status: Literal["open", "in_progress", "resolved"]


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
    created_at: datetime