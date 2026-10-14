import random
from datetime import date, timedelta

from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.models import FuelLog, Vehicle

Base.metadata.create_all(bind=engine)

random.seed(42)  # same data every time

BASE_PRICE = 89.0  # ETB per liter (placeholder - check the real price)

# plate_number: (liters per fill-up, km driven between fill-ups)
PROFILES = {
    "AA-3-10234": (90, 1400),   # Truck 02, Isuzu NPR
    "AA-3-10871": (110, 1500),  # Truck 03, Isuzu FSR
    "OR-3-55120": (140, 1700),  # Truck 04, Sinotruk HOWO
    "AA-2-30011": (55, 900),    # Pickup 01, Hilux
    "AA-2-31200": (60, 800),    # SUV 01, Land Cruiser
    "AA-3-20991": (120, 1300),  # Bus 02, Higer
    "AA-3-40222": (50, 750),    # Minibus 01, HiAce
    "OR-3-60310": (80, 1250),   # Truck 06, Fuso Canter
}

FILLUPS = 6
GAP_DAYS = 15


def main():
    db = SessionLocal()
    added = 0
    today = date.today()
    try:
        for plate, (liters, km) in PROFILES.items():
            vehicle = db.scalar(select(Vehicle).where(Vehicle.plate_number == plate))
            if vehicle is None:
                continue
            for i in range(FILLUPS):
                steps_back = FILLUPS - 1 - i
                fuel_date = today - timedelta(days=3 + steps_back * GAP_DAYS)
                odometer = vehicle.odometer_km - steps_back * km
                if odometer < 0:
                    continue
                exists = db.scalar(
                    select(FuelLog).where(
                        FuelLog.vehicle_id == vehicle.id,
                        FuelLog.fuel_date == fuel_date,
                    )
                )
                if exists:
                    continue
                price = BASE_PRICE + (FILLUPS - 1 - steps_back) * 0.8 + random.uniform(-0.5, 0.5)
                db.add(FuelLog(
                    vehicle_id=vehicle.id,
                    fuel_date=fuel_date,
                    liters=round(liters * random.uniform(0.9, 1.1), 1),
                    price_per_liter_etb=round(price, 2),
                    odometer_km=odometer,
                ))
                added += 1
        db.commit()
    finally:
        db.close()
    print(f"Done. Added {added} fuel records.")


if __name__ == "__main__":
    main()