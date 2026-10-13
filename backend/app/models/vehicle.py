from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    plate_number: Mapped[str] = mapped_column(String(30), unique=True)
    name: Mapped[str | None] = mapped_column(String(100), nullable=True)  # e.g. "Truck 01"
    make: Mapped[str | None] = mapped_column(String(50), nullable=True)  # e.g. Isuzu
    model: Mapped[str | None] = mapped_column(String(50), nullable=True)  # e.g. FSR
    year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    vehicle_type: Mapped[str] = mapped_column(String(30), default="truck")  # truck, bus, pickup, minibus
    fuel_type: Mapped[str] = mapped_column(String(20), default="diesel")
    status: Mapped[str] = mapped_column(String(20), default="idle")  # active, idle, maintenance, offline
    odometer_km: Mapped[float] = mapped_column(Float, default=0.0)
    driver_id: Mapped[int | None] = mapped_column(ForeignKey("drivers.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    driver: Mapped["Driver | None"] = relationship(back_populates="vehicles")