from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class FuelLog(Base):
    __tablename__ = "fuel_logs"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), index=True)
    fuel_date: Mapped[date] = mapped_column(Date, index=True)
    liters: Mapped[float] = mapped_column(Float)
    price_per_liter_etb: Mapped[float] = mapped_column(Float)
    odometer_km: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Workflow fields. Admin-entered records are "verified" straight away.
    # Driver-entered ones start as "submitted".
    status: Mapped[str] = mapped_column(
        String(20), default="verified", server_default="verified", index=True
    )  # submitted, verified, needs_correction, rejected
    driver_id: Mapped[int | None] = mapped_column(ForeignKey("drivers.id"), nullable=True)
    request_id: Mapped[int | None] = mapped_column(ForeignKey("fuel_requests.id"), nullable=True)
    station: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    review_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    vehicle: Mapped["Vehicle"] = relationship()
    driver: Mapped["Driver | None"] = relationship()
    request: Mapped["FuelRequest | None"] = relationship()
    reviewer: Mapped["User | None"] = relationship()

    @property
    def vehicle_name(self):
        return self.vehicle.name if self.vehicle else None

    @property
    def driver_name(self):
        return self.driver.full_name if self.driver else None

    @property
    def reviewer_name(self):
        return self.reviewer.full_name if self.reviewer else None

    @property
    def total_cost_etb(self):
        return round(self.liters * self.price_per_liter_etb, 2)

    @property
    def approved_liters(self):
        return self.request.approved_liters if self.request else None

    @property
    def difference_liters(self):
        """Actual minus approved liters (negative = less fuel than approved)."""
        if self.approved_liters is None:
            return None
        return round(self.liters - self.approved_liters, 1)