from datetime import date

from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.models import Driver, Vehicle

Base.metadata.create_all(bind=engine)

DRIVERS = [
    {"full_name": "Tesfaye Alemu", "phone": "+251911223344", "license_number": "AA-20431", "license_class": "Level 5", "license_expiry": date(2027, 9, 14), "status": "active", "safety_score": 92},
    {"full_name": "Mulugeta Haile", "phone": "+251922334455", "license_number": "AA-20987", "license_class": "Level 4", "license_expiry": date(2026, 11, 20), "status": "active", "safety_score": 78},
    {"full_name": "Dawit Bekele", "phone": "+251933445566", "license_number": "OR-11872", "license_class": "Level 5", "license_expiry": date(2028, 3, 5), "status": "active", "safety_score": 88},
    {"full_name": "Yonas Tadesse", "phone": "+251944556677", "license_number": "AA-21560", "license_class": "Level 3", "license_expiry": date(2027, 1, 30), "status": "active", "safety_score": 65},
    {"full_name": "Henok Girma", "phone": "+251955667788", "license_number": "AM-30415", "license_class": "Level 4", "license_expiry": date(2026, 8, 15), "status": "active", "safety_score": 71},
    {"full_name": "Samuel Desta", "phone": "+251966778899", "license_number": "AA-22108", "license_class": "Level 5", "license_expiry": date(2029, 2, 10), "status": "active", "safety_score": 97},
    {"full_name": "Getachew Mengesha", "phone": "+251977889900", "license_number": "OR-12344", "license_class": "Level 4", "license_expiry": date(2027, 7, 22), "status": "on_leave", "safety_score": 84},
    {"full_name": "Biniam Worku", "phone": "+251988990011", "license_number": "AA-22765", "license_class": "Level 3", "license_expiry": date(2028, 11, 1), "status": "active", "safety_score": 59},
    {"full_name": "Eyob Negash", "phone": "+251911002233", "license_number": "AM-30977", "license_class": "Level 5", "license_expiry": date(2027, 5, 18), "status": "active", "safety_score": 90},
    {"full_name": "Meseret Abera", "phone": "+251922113344", "license_number": "AA-23190", "license_class": "Level 2", "license_expiry": date(2028, 6, 9), "status": "active", "safety_score": 95},
]

# driver = the license number of the driver assigned (or None)
VEHICLES = [
    {"plate_number": "AA-3-10234", "name": "Truck 02", "make": "Isuzu", "model": "NPR", "year": 2019, "vehicle_type": "truck", "fuel_type": "diesel", "status": "active", "odometer_km": 142300, "driver": "AA-20431"},
    {"plate_number": "AA-3-10871", "name": "Truck 03", "make": "Isuzu", "model": "FSR", "year": 2021, "vehicle_type": "truck", "fuel_type": "diesel", "status": "active", "odometer_km": 68500, "driver": "AA-20987"},
    {"plate_number": "OR-3-55120", "name": "Truck 04", "make": "Sinotruk", "model": "HOWO", "year": 2018, "vehicle_type": "truck", "fuel_type": "diesel", "status": "active", "odometer_km": 231400, "driver": "OR-11872"},
    {"plate_number": "AA-3-11902", "name": "Truck 05", "make": "FAW", "model": "J6", "year": 2020, "vehicle_type": "truck", "fuel_type": "diesel", "status": "maintenance", "odometer_km": 109800, "driver": None},
    {"plate_number": "AA-2-30011", "name": "Pickup 01", "make": "Toyota", "model": "Hilux", "year": 2022, "vehicle_type": "pickup", "fuel_type": "diesel", "status": "active", "odometer_km": 41200, "driver": "AA-21560"},
    {"plate_number": "AA-2-30458", "name": "Pickup 02", "make": "Toyota", "model": "Hilux", "year": 2021, "vehicle_type": "pickup", "fuel_type": "diesel", "status": "idle", "odometer_km": 77650, "driver": "AM-30415"},
    {"plate_number": "AA-2-31200", "name": "SUV 01", "make": "Toyota", "model": "Land Cruiser", "year": 2023, "vehicle_type": "suv", "fuel_type": "diesel", "status": "active", "odometer_km": 18900, "driver": "AA-22108"},
    {"plate_number": "AA-3-20876", "name": "Bus 01", "make": "Hyundai", "model": "County", "year": 2017, "vehicle_type": "bus", "fuel_type": "diesel", "status": "idle", "odometer_km": 198000, "driver": "OR-12344"},
    {"plate_number": "AA-3-20991", "name": "Bus 02", "make": "Higer", "model": "KLQ6129", "year": 2019, "vehicle_type": "bus", "fuel_type": "diesel", "status": "active", "odometer_km": 154700, "driver": "AA-22765"},
    {"plate_number": "AA-3-40222", "name": "Minibus 01", "make": "Toyota", "model": "HiAce", "year": 2018, "vehicle_type": "minibus", "fuel_type": "diesel", "status": "active", "odometer_km": 176300, "driver": "AM-30977"},
    {"plate_number": "OR-3-60310", "name": "Truck 06", "make": "Mitsubishi", "model": "Fuso Canter", "year": 2020, "vehicle_type": "truck", "fuel_type": "diesel", "status": "active", "odometer_km": 95400, "driver": None},
    {"plate_number": "AA-3-12450", "name": "Truck 07", "make": "Iveco", "model": "Eurocargo", "year": 2016, "vehicle_type": "truck", "fuel_type": "diesel", "status": "offline", "odometer_km": 289000, "driver": "AA-23190"},
]


def main():
    db = SessionLocal()
    added_drivers = 0
    added_vehicles = 0
    try:
        for d in DRIVERS:
            exists = db.scalar(select(Driver).where(Driver.license_number == d["license_number"]))
            if not exists:
                db.add(Driver(**d))
                added_drivers += 1
        db.commit()

        for v in VEHICLES:
            exists = db.scalar(select(Vehicle).where(Vehicle.plate_number == v["plate_number"]))
            if exists:
                continue
            data = {k: val for k, val in v.items() if k != "driver"}
            if v["driver"]:
                driver = db.scalar(select(Driver).where(Driver.license_number == v["driver"]))
                data["driver_id"] = driver.id if driver else None
            db.add(Vehicle(**data))
            added_vehicles += 1
        db.commit()
    finally:
        db.close()

    print(f"Done. Added {added_drivers} drivers and {added_vehicles} vehicles.")


if __name__ == "__main__":
    main()