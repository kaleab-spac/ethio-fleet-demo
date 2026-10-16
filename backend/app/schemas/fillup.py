from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class FillUpCreate(BaseModel):
    vehicle_id: int
    request_id: int | None = None
    fuel_date: date
    liters: float = Field(gt=0, le=2000)
    price_per_liter_etb: float = Field(gt=0, le=1000)
    odometer_km: float = Field(gt=0)
    station: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=500)


class FillUpUpdate(BaseModel):
    fuel_date: date | None = None
    liters: float | None = Field(default=None, gt=0, le=2000)
    price_per_liter_etb: float | None = Field(default=None, gt=0, le=1000)
    odometer_km: float | None = Field(default=None, gt=0)
    station: str | None = Field(default=None, max_length=100)
    notes: str | None = Field(default=None, max_length=500)


class FillUpReview(BaseModel):
    decision: Literal["verified", "needs_correction", "rejected"]
    reason: str | None = Field(default=None, max_length=500)


class FillUpOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vehicle_id: int
    vehicle_name: str | None = None
    driver_id: int | None = None
    driver_name: str | None = None
    request_id: int | None = None
    fuel_date: date
    liters: float
    price_per_liter_etb: float
    total_cost_etb: float
    odometer_km: float
    station: str | None = None
    notes: str | None = None
    status: str
    review_reason: str | None = None
    reviewer_name: str | None = None
    reviewed_at: datetime | None = None
    approved_liters: float | None = None
    difference_liters: float | None = None
    created_at: datetime
    flags: list[str] = []