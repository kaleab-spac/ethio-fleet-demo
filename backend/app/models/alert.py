from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vehicle_id: Mapped[int | None] = mapped_column(ForeignKey("vehicles.id"), nullable=True, index=True)
    geofence_id: Mapped[int | None] = mapped_column(ForeignKey("geofences.id"), nullable=True)
    alert_type: Mapped[str] = mapped_column(String(30))   # speeding, geofence_exit, geofence_enter, license, safety
    severity: Mapped[str] = mapped_column(String(10), default="medium")  # low, medium, high
    message: Mapped[str] = mapped_column(String(300))
    acknowledged: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    vehicle: Mapped["Vehicle | None"] = relationship()

    @property
    def vehicle_name(self):
        return self.vehicle.name if self.vehicle else None