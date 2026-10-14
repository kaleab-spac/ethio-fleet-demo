from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, ForeignKey
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

    vehicle: Mapped["Vehicle"] = relationship()

    @property
    def vehicle_name(self):
        return self.vehicle.name if self.vehicle else None

    @property
    def total_cost_etb(self):
        return round(self.liters * self.price_per_liter_etb, 2)