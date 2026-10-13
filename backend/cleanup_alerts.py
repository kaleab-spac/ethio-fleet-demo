from sqlalchemy import update

from app.database import SessionLocal
from app.models import Alert

AUTO_TYPES = ["speeding", "geofence_enter", "geofence_exit"]


def main():
    db = SessionLocal()
    try:
        result = db.execute(
            update(Alert)
            .where(Alert.alert_type.in_(AUTO_TYPES), Alert.acknowledged.is_(False))
            .values(acknowledged=True)
        )
        db.commit()
        print(f"Done. Acknowledged {result.rowcount} automatic alerts.")
    finally:
        db.close()


if __name__ == "__main__":
    main()