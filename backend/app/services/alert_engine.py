import math
import time

from sqlalchemy import func, select

from app.models import Alert, Geofence, Position, Vehicle

SPEED_LIMIT_KMH = 78
SPEED_COOLDOWN_S = 120

def distance_m(lat1, lon1, lat2, lon2):
    """Distance between two GPS points in meters."""
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def check_alerts(db, state):
    """Look at the latest position of every vehicle and create alerts.
    'state' is a dictionary the caller keeps between calls, so we remember
    who was inside which zone. Returns the number of new alerts."""
    geofences = db.scalars(select(Geofence).where(Geofence.active.is_(True))).all()
    latest_ids = select(func.max(Position.id)).group_by(Position.vehicle_id).scalar_subquery()
    positions = db.scalars(select(Position).where(Position.id.in_(latest_ids))).all()

    now = time.time()
    created = 0

    for p in positions:
        vehicle = db.get(Vehicle, p.vehicle_id)
        name = vehicle.name if vehicle and vehicle.name else f"Vehicle {p.vehicle_id}"

        # 1. Speeding
        key = ("speed", p.vehicle_id)
        if round(p.speed_kmh) > SPEED_LIMIT_KMH and now - state.get(key, 0) > SPEED_COOLDOWN_S:
            state[key] = now
            db.add(Alert(
                vehicle_id=p.vehicle_id,
                alert_type="speeding",
                severity="high",
                message=f"{name} is speeding at {round(p.speed_kmh)} km/h (limit {SPEED_LIMIT_KMH})",
            ))
            created += 1

        # 2. Geofence enter / exit
        for g in geofences:
            inside = distance_m(p.latitude, p.longitude, g.latitude, g.longitude) <= g.radius_m
            key = ("fence", p.vehicle_id, g.id)
            was_inside = state.get(key)
            state[key] = inside

            if was_inside is None or was_inside == inside:
                continue  # first time seen, or nothing changed

            action = "entered" if inside else "left"
            db.add(Alert(
                vehicle_id=p.vehicle_id,
                geofence_id=g.id,
                alert_type="geofence_enter" if inside else "geofence_exit",
                severity="low" if inside else "medium",
                message=f"{name} {action} {g.name}",
            ))
            created += 1

    db.commit()
    return created