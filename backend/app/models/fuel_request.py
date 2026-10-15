from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class FuelRequest(Base):
    __tablename__ = "fuel_requests"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("drivers.id"), index=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), index=True)
    fuel_type: Mapped[str] = mapped_column(String(20), default="diesel")
    requested_liters: Mapped[float] = mapped_column(Float)
    approved_liters: Mapped[float | None] = mapped_column(Float, nullable=True)
    odometer_km: Mapped[float] = mapped_column(Float, default=0.0)
    purpose: Mapped[str | None] = mapped_column(String(200), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    decision_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )

    driver: Mapped["Driver"] = relationship()
    vehicle: Mapped["Vehicle"] = relationship()
    reviewer: Mapped["User | None"] = relationship()

    @property
    def driver_name(self):
        return self.driver.full_name if self.driver else None

    @property
    def vehicle_name(self):
        return self.vehicle.name if self.vehicle else None

    @property
    def reviewer_name(self):
        return self.reviewer.full_name if self.reviewer else None