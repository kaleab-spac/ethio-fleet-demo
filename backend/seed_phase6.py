from datetime import date, timedelta

from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.models import Maintenance, Vehicle

Base.metadata.create_all(bind=engine)

today = date.today()


def d(days):
    """A date 'days' from today (negative = in the past)."""
    return today + timedelta(days=days)


# (plate_number, service_type, description, days_ago, cost_etb,
#  next_due_in_days, next_due_odometer_km or None)
# next_due_in_days: negative = already overdue
RECORDS = [
    # Overdue by date
    ("AA-3-10871", "Oil change", "Engine oil and filter", -120, 4800, -30, None),
    ("AA-3-20991", "Annual inspection (Bolo)", "Yearly vehicle inspection", -380, 1500, -15, None),
    ("AA-3-12450", "Brake service", "Brake pads and discs", -200, 18500, -10, None),
    # Overdue by odometer (vehicle odometer is already past this reading)
    ("AA-3-10234", "Oil change", "Engine oil and filter", -60, 4500, 30, 141000),
    # Due soon
    ("AA-3-45678", "Oil change", "Engine oil and filter", -75, 4200, 14, 86000),
    ("OR-3-55120", "Tire rotation", "Rotate and balance tires", -85, 2200, 20, None),
    ("AA-2-30458", "Annual inspection (Bolo)", "Yearly vehicle inspection", -350, 1500, 12, None),
    ("AA-3-20876", "Air filter", "Replace air and cabin filters", -150, 3200, 25, None),
    # Fine for now
    ("AA-3-10871", "Tire rotation", "Rotate and balance tires", -30, 2200, 60, None),
    ("AA-2-30011", "Oil change", "Engine oil and filter", -20, 4000, 100, 51000),
    ("AA-2-31200", "Oil change", "Engine oil and filter", -15, 5200, 105, 28000),
    ("AA-3-40222", "Battery replacement", "New 100Ah battery", -40, 9800, 320, None),
    ("AA-3-11902", "Gearbox repair", "Clutch and gearbox overhaul", -10, 42000, 170, None),
    ("OR-3-60310", "Annual inspection (Bolo)", "Yearly vehicle inspection", -90, 1500, 275, None),
]


def main():
    db = SessionLocal()
    added = 0
    try:
        for plate, stype, desc, ago, cost, due_days, due_km in RECORDS:
            vehicle = db.scalar(select(Vehicle).where(Vehicle.plate_number == plate))
            if vehicle is None:
                continue
            service_date = d(ago)
            exists = db.scalar(
                select(Maintenance).where(
                    Maintenance.vehicle_id == vehicle.id,
                    Maintenance.service_type == stype,
                    Maintenance.service_date == service_date,
                )
            )
            if exists:
                continue
            db.add(Maintenance(
                vehicle_id=vehicle.id,
                service_type=stype,
                description=desc,
                service_date=service_date,
                odometer_km=max(vehicle.odometer_km - abs(ago) * 60, 0),
                cost_etb=cost,
                next_due_date=d(due_days),
                next_due_odometer_km=due_km,
            ))
            added += 1
        db.commit()
    finally:
        db.close()
    print(f"Done. Added {added} maintenance records.")


if __name__ == "__main__":
    main()