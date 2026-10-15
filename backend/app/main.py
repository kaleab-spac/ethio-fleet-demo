from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app import models  # noqa: F401  (makes sure the tables are known)
from app.deps import get_current_user
from app.models.user import User
from app.routers import (
    alerts, audit, auth, dashboard, defects, driver_portal, drivers, fuel, geofences,
    maintenance, notifications, positions, reports, users, vehicles,
)

# Create the tables in fms.db if they don't exist yet
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Fleet Management System API", version="1.5.0")

# CORS lets our React app (port 5173) talk to this backend (port 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def fleet_access(request: Request, user: User = Depends(get_current_user)) -> User:
    """Rules for fleet-wide data:
    - drivers: no access at all (they use /api/driver instead)
    - viewers: read only (GET)
    - admins: everything
    """
    if user.role == "driver":
        raise HTTPException(status_code=403, detail="Drivers cannot access fleet-wide data")
    if request.method != "GET" and user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# Login is open to everyone
app.include_router(auth.router)

# Account management and the audit log: these routers require an admin themselves
app.include_router(users.router)
app.include_router(audit.router)

# Own notifications: any logged-in user, always limited to their own rows
app.include_router(notifications.router)

# The driver's own data: the router itself requires a driver
app.include_router(driver_portal.router)

# Everything else is fleet-wide data
protected = [Depends(fleet_access)]
for r in (
    drivers.router, vehicles.router, dashboard.router, positions.router,
    geofences.router, alerts.router, maintenance.router, fuel.router, reports.router,
    defects.router,
):
    app.include_router(r, dependencies=protected)


@app.get("/")
def root():
    return {"message": "Fleet Management System API is running"}


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "fms-backend"}