from datetime import date, datetime

from pydantic import BaseModel, ConfigDict, Field


class DriverBase(BaseModel):
    full_name: str = Field(min_length=2, max_length=100)
    phone: str | None = None
    license_number: str = Field(min_length=3, max_length=50)
    license_class: str | None = None
    license_expiry: date | None = None
    status: str = "active"
    safety_score: int = Field(default=100, ge=0, le=100)


class DriverCreate(DriverBase):
    pass


class DriverUpdate(BaseModel):
    full_name: str | None = None
    phone: str | None = None
    license_number: str | None = None
    license_class: str | None = None
    license_expiry: date | None = None
    status: str | None = None
    safety_score: int | None = Field(default=None, ge=0, le=100)


class DriverOut(DriverBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    created_at: datetime