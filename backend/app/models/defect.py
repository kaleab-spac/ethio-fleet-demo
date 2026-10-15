from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DefectReport(Base):
    __tablename__ = "defect_reports"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), index=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("drivers.id"), index=True)
    description: Mapped[str] = mapped_column(String(500))
    severity: Mapped[str] = mapped_column(String(10), default="medium")  # low, medium, high
    status: Mapped[str] = mapped_column(String(20), default="open")  # open, in_progress, resolved
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    vehicle: Mapped["Vehicle"] = relationship()
    driver: Mapped["Driver"] = relationship()

    @property
    def vehicle_name(self):
        return self.vehicle.name if self.vehicle else None

    @property
    def driver_name(self):
        return self.driver.full_name if self.driver else None