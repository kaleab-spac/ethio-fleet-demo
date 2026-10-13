from datetime import date, timedelta

from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.models import Alert, Driver, Geofence, Vehicle

Base.metadata.create_all(bind=engine)

GEOFENCES = [
    {"name": "Kality Depot", "latitude": 8.9667, "longitude": 38.7667, "radius_m": 2000},
    {"name": "Addis Ababa City", "latitude": 9.02, "longitude": 38.77, "radius_m": 9000},
    {"name": "Adama Hub", "latitude": 8.54, "longitude": 39.27, "radius_m": 6000},
    {"name": "Hawassa Terminal", "latitude": 7.06, "longitude": 38.48, "radius_m": 5000},
    {"name": "Awash Checkpoint", "latitude": 8.98, "longitude": 40.17, "radius_m": 5000},
]


def add_alert(db, vehicle, alert_type, severity, message):
    exists = db.scalar(select(Alert).where(Alert.message == message))
    if exists:
        return 0
    db.add(Alert(vehicle_id=vehicle.id, alert_type=alert_type, severity=severity, message=message))
    return 1


def main():
    db = SessionLocal()
    zones = 0
    alerts = 0
    today = date.today()
    soon = today + timedelta(days=60)
    try:
        for g in GEOFENCES:
            if not db.scalar(select(Geofence).where(Geofence.name == g["name"])):
                db.add(Geofence(**g))
                zones += 1
        db.commit()

        for d in db.scalars(select(Driver)).all():
            vehicles = db.scalars(select(Vehicle).where(Vehicle.driver_id == d.id)).all()
            for v in vehicles:
                if d.license_expiry and d.license_expiry < today:
                    alerts += add_alert(db, v, "license", "high",
                        f"{d.full_name} ({v.name}): driver license expired on {d.license_expiry}")
                elif d.license_expiry and d.license_expiry <= soon:
                    days = (d.license_expiry - today).days
                    alerts += add_alert(db, v, "license", "medium",
                        f"{d.full_name} ({v.name}): driver license expires in {days} days")
                if d.safety_score < 70:
                    alerts += add_alert(db, v, "safety", "medium",
                        f"{d.full_name} ({v.name}): low driver safety score ({d.safety_score})")
        db.commit()
    finally:
        db.close()

    print(f"Done. Added {zones} geofences and {alerts} driver alerts.")


if __name__ == "__main__":
    main()