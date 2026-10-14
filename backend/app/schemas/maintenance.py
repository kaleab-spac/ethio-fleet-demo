from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class MaintenanceCreate(BaseModel):
    vehicle_id: int
    service_type: str = Field(min_length=2, max_length=60)
    description: str | None = None
    service_date: date
    odometer_km: float = Field(default=0.0, ge=0)
    cost_etb: float = Field(default=0.0, ge=0)
    next_due_date: date | None = None
    next_due_odometer_km: float | None = Field(default=None, ge=0)


class MaintenanceUpdate(BaseModel):
    service_type: str | None = None
    description: str | None = None
    service_date: date | None = None
    odometer_km: float | None = Field(default=None, ge=0)
    cost_etb: float | None = Field(default=None, ge=0)
    next_due_date: date | None = None
    next_due_odometer_km: float | None = Field(default=None, ge=0)


class MaintenanceOut(MaintenanceCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vehicle_name: str | None = None
    created_at: datetime