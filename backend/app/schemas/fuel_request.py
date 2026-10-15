from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class FuelRequestCreate(BaseModel):
    vehicle_id: int
    fuel_type: Literal["diesel", "petrol"] = "diesel"
    requested_liters: float = Field(gt=0, le=1000)
    odometer_km: float = Field(default=0.0, ge=0)
    purpose: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=500)


class FuelRequestDecision(BaseModel):
    decision: Literal["approved", "rejected"]
    approved_liters: float | None = Field(default=None, gt=0, le=1000)
    reason: str | None = Field(default=None, max_length=500)


class FuelRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    driver_id: int
    driver_name: str | None = None
    vehicle_id: int
    vehicle_name: str | None = None
    fuel_type: str
    requested_liters: float
    approved_liters: float | None = None
    odometer_km: float
    purpose: str | None = None
    notes: str | None = None
    status: str
    decision_reason: str | None = None
    reviewer_name: str | None = None
    reviewed_at: datetime | None = None
    created_at: datetime