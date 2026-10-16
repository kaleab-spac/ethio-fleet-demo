from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class DefectReport(Base):
    __tablename__ = "defect_reports"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id"), index=True)
    driver_id: Mapped[int] = mapped_column(ForeignKey("drivers.id"), index=True)
    description: Mapped[str] = mapped_column(String(500))
    severity: Mapped[str] = mapped_column(String(10), default="medium")  # low, medium, high, critical
    status: Mapped[str] = mapped_column(String(20), default="open")
    # open, acknowledged, in_progress, resolved, closed, rejected
    category: Mapped[str | None] = mapped_column(String(30), nullable=True)
    odometer_km: Mapped[float | None] = mapped_column(Float, nullable=True)
    resolution: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    vehicle: Mapped["Vehicle"] = relationship()
    driver: Mapped["Driver"] = relationship()
    comments: Mapped[list["DefectComment"]] = relationship(order_by="DefectComment.id")
    history: Mapped[list["DefectHistory"]] = relationship(order_by="DefectHistory.id")

    @property
    def vehicle_name(self):
        return self.vehicle.name if self.vehicle else None

    @property
    def driver_name(self):
        return self.driver.full_name if self.driver else None


class DefectComment(Base):
    __tablename__ = "defect_comments"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    defect_id: Mapped[int] = mapped_column(ForeignKey("defect_reports.id"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(String(500))
    visible_to_driver: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    author: Mapped["User"] = relationship()

    @property
    def author_name(self):
        return self.author.full_name if self.author else None


class DefectHistory(Base):
    __tablename__ = "defect_history"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    defect_id: Mapped[int] = mapped_column(ForeignKey("defect_reports.id"), index=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    from_status: Mapped[str | None] = mapped_column(String(20), nullable=True)
    to_status: Mapped[str] = mapped_column(String(20))
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    actor: Mapped["User | None"] = relationship()

    @property
    def actor_name(self):
        return self.actor.full_name if self.actor else None