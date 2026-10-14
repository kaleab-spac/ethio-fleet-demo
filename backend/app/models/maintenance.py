from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Maintenance(Base):
    __tablename__ = "maintenance"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), index=True)
    service_type: Mapped[str] = mapped_column(String(60))  # e.g. Oil change, Tire rotation
    description: Mapped[str | None] = mapped_column(String(300), nullable=True)
    service_date: Mapped[date] = mapped_column(Date)
    odometer_km: Mapped[float] = mapped_column(Float, default=0.0)
    cost_etb: Mapped[float] = mapped_column(Float, default=0.0)  # cost in Ethiopian birr
    next_due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    next_due_odometer_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    vehicle: Mapped["Vehicle"] = relationship()

    @property
    def vehicle_name(self):
        return self.vehicle.name if self.vehicle else None