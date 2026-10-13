import math
import random
import time

from sqlalchemy import delete

from app.database import Base, SessionLocal, engine
from app.models import Position, Vehicle
from app.services.alert_engine import check_alerts
Base.metadata.create_all(bind=engine)

TICK_SECONDS = 3   # how often positions are saved
SPEEDUP = 25       # demo speed-up: vehicles move 25x faster than real life

# Routes are lists of (latitude, longitude) points along real Ethiopian roads
ADDIS_AWASH = [
    (9.005, 38.763), (8.80, 38.92), (8.75, 38.98), (8.59, 39.12),
    (8.54, 39.27), (8.67, 39.43), (8.90, 39.92), (8.98, 40.17),
]
ADDIS_HAWASSA = [
    (9.005, 38.763), (8.80, 38.92), (8.75, 38.98), (8.59, 39.12),
    (8.15, 38.82), (7.93, 38.72), (7.20, 38.60), (7.06, 38.48),
]
ADDIS_AMBO = [(9.03, 38.74), (9.06, 38.50), (9.02, 38.13), (8.98, 37.85)]
ADDIS_DEBRE_BERHAN = [(9.05, 38.77), (9.15, 39.03), (9.68, 39.53)]
ADDIS_ADAMA = [
    (9.005, 38.763), (8.80, 38.92), (8.75, 38.98), (8.59, 39.12), (8.54, 39.27),
]
ADDIS_CITY = [(9.035, 38.752), (9.01, 38.74), (8.99, 38.79), (9.02, 38.80)]

# vehicle_id: (route, start position 0.0-1.0 along the route, typical speed in km/h)
MOVING = {
    2: (ADDIS_AWASH, 0.10, 65),
    3: (ADDIS_HAWASSA, 0.30, 60),
    4: (ADDIS_AMBO, 0.50, 55),
    6: (ADDIS_DEBRE_BERHAN, 0.40, 70),
    8: (ADDIS_CITY, 0.20, 30),
    10: (ADDIS_HAWASSA, 0.75, 65),
    11: (ADDIS_ADAMA, 0.60, 70),
    12: (ADDIS_AWASH, 0.65, 60),
}

# vehicle_id: (latitude, longitude)  -> parked, speed 0
PARKED = {
    1: (8.9667, 38.7667),   # Truck 01 - depot in Kality, Addis Ababa
    5: (8.88, 38.80),       # Truck 05 - garage in Akaki (maintenance)
    7: (8.99, 38.80),       # Pickup 02 - Bole, Addis Ababa
    9: (9.03, 38.73),       # Bus 01 - Autobus Tera, Addis Ababa
    13: (8.54, 39.27),      # Truck 07 - Adama (offline)
}


def haversine_km(a, b):
    r = 6371.0
    lat1, lon1, lat2, lon2 = map(math.radians, (a[0], a[1], b[0], b[1]))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


def bearing(a, b):
    lat1, lat2 = math.radians(a[0]), math.radians(b[0])
    dlon = math.radians(b[1] - a[1])
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
    return (math.degrees(math.atan2(x, y)) + 360) % 360


def route_length(route):
    return sum(haversine_km(route[i], route[i + 1]) for i in range(len(route) - 1))


def point_at(route, dist):
    """Latitude, longitude and heading after driving 'dist' km along the route."""
    remaining = dist
    for i in range(len(route) - 1):
        a, b = route[i], route[i + 1]
        seg = haversine_km(a, b)
        if remaining <= seg or i == len(route) - 2:
            f = min(remaining / seg, 1.0) if seg > 0 else 0.0
            lat = a[0] + (b[0] - a[0]) * f
            lon = a[1] + (b[1] - a[1]) * f
            return lat, lon, bearing(a, b)
        remaining -= seg


def main():
    db = SessionLocal()

    # Start fresh: remove old positions (including the manual test point)
    db.execute(delete(Position))
    db.commit()

    # Parked vehicles report once
    for vid, (lat, lon) in PARKED.items():
        if db.get(Vehicle, vid):
            db.add(Position(vehicle_id=vid, latitude=lat, longitude=lon, speed_kmh=0, heading=0))
    db.commit()

    # Set up the moving vehicles
    state = {}
    for vid, (route, start, speed) in MOVING.items():
        if db.get(Vehicle, vid) is None:
            continue
        total = route_length(route)
        state[vid] = {"route": route, "total": total, "dist": total * start, "dir": 1, "speed": speed}

    print(f"Simulator running: {len(state)} moving vehicles, {len(PARKED)} parked. Press Ctrl+C to stop.")
    alert_state = {}
    try:
        while True:
            for vid, s in state.items():
                speed = max(20, s["speed"] + random.uniform(-8, 8))
                s["dist"] += s["dir"] * speed * (TICK_SECONDS / 3600) * SPEEDUP
                if s["dist"] >= s["total"]:
                    s["dist"], s["dir"] = s["total"], -1
                elif s["dist"] <= 0:
                    s["dist"], s["dir"] = 0, 1

                lat, lon, head = point_at(s["route"], s["dist"])
                if s["dir"] == -1:
                    head = (head + 180) % 360

                db.add(Position(
                    vehicle_id=vid,
                    latitude=lat,
                    longitude=lon,
                    speed_kmh=round(speed, 1),
                    heading=int(round(head)) % 360,
                ))
            db.commit()

            new_alerts = check_alerts(db, alert_state)
            print(f"Updated {len(state)} vehicles, {new_alerts} new alerts")
            time.sleep(TICK_SECONDS)
    except KeyboardInterrupt:
        print("Simulator stopped.")
    finally:
        db.close()


if __name__ == "__main__":
    main()