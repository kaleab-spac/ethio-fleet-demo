from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AlertCreate(BaseModel):
    vehicle_id: int | None = None
    geofence_id: int | None = None
    alert_type: str
    severity: str = "medium"
    message: str


class AlertOut(AlertCreate):
    model_config = ConfigDict(from_attributes=True)

    id: int
    vehicle_name: str | None = None
    acknowledged: bool
    created_at: datetime