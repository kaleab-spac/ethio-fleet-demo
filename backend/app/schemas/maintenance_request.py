from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Category = Literal[
    "oil_change", "brakes", "tires", "engine", "electrical", "body", "inspection", "other"
]


class MaintReqCreate(BaseModel):
    vehicle_id: int
    category: Category
    description: str = Field(min_length=5, max_length=500)
    urgency: Literal["low", "medium", "high", "urgent"] = "medium"
    odometer_km: float = Field(default=0.0, ge=0)
    preferred_date: date | None = None
    notes: str | None = Field(default=None, max_length=500)
    defect_id: int | None = None


class MaintReqAction(BaseModel):
    action: Literal["approve", "reject", "schedule", "start", "complete", "cancel"]
    reason: str | None = Field(default=None, max_length=500)
    scheduled_date: date | None = None
    provider: str | None = Field(default=None, max_length=100)
    cost_etb: float | None = Field(default=None, ge=0)
    odometer_km: float | None = Field(default=None, ge=0)
    next_due_date: date | None = None
    next_due_odometer_km: float | None = Field(default=None, ge=0)


class LinkDefect(BaseModel):
    defect_id: int | None = None  # null removes the link


class MaintReqOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    driver_id: int
    driver_name: str | None = None
    vehicle_id: int
    vehicle_name: str | None = None
    category: str
    description: str
    urgency: str
    odometer_km: float
    preferred_date: date | None = None
    notes: str | None = None
    status: str
    decision_reason: str | None = None
    scheduled_date: date | None = None
    provider: str | None = None
    defect_id: int | None = None
    maintenance_id: int | None = None
    reviewer_name: str | None = None
    reviewed_at: datetime | None = None
    completed_at: datetime | None = None
    created_at: datetime