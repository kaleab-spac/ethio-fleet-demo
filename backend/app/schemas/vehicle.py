from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class VehicleBase(BaseModel):
    plate_number: str = Field(min_length=3, max_length=30)
    name: str | None = None
    make: str | None = None
    model: str | None = None
    year: int | None = Field(default=None, ge=1980, le=2100)
    vehicle_type: str = "truck"
    fuel_type: str = "diesel"
    status: str = "idle"
    odometer_km: float = Field(default=0.0, ge=0)
    driver_id: int | None = None
    archived: bool = False


class VehicleCreate(VehicleBase):
    pass


class VehicleUpdate(BaseModel):
    plate_number: str | None = None
    name: str | None = None
    make: str | None = None
    model: str | None = None
    year: int | None = Field(default=None, ge=1980, le=2100)
    vehicle_type: str | None = None
    fuel_type: str | None = None
    status: str | None = None
    odometer_km: float | None = Field(default=None, ge=0)
    driver_id: int | None = None
    archived: bool | None = None


class VehicleOut(VehicleBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime