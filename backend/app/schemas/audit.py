from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    actor_name: str | None = None
    action: str
    entity_type: str
    entity_id: int | None = None
    details: str | None = None
    created_at: datetime