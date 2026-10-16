from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class MaintenanceRequest(Base):
    __tablename__ = "maintenance_requests"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("drivers.id"), index=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), index=True)
    category: Mapped[str] = mapped_column(String(30))
    description: Mapped[str] = mapped_column(String(500))
    urgency: Mapped[str] = mapped_column(String(10), default="medium")  # low, medium, high, urgent
    odometer_km: Mapped[float] = mapped_column(Float, default=0.0)
    preferred_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="pending", index=True)
    decision_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    scheduled_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    provider: Mapped[str | None] = mapped_column(String(100), nullable=True)
    defect_id: Mapped[int | None] = mapped_column(ForeignKey("defect_reports.id"), nullable=True)
    maintenance_id: Mapped[int | None] = mapped_column(ForeignKey("maintenance.id"), nullable=True)
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
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