from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class FuelCreate(BaseModel):
    vehicle_id: int
    fuel_date: date
    liters: float = Field(gt=0, le=2000)
    price_per_liter_etb: float = Field(gt=0, le=1000)
    odometer_km: float = Field(default=0.0, ge=0)


class FuelOut(FuelCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vehicle_name: str | None = None
    total_cost_etb: float
    created_at: datetime