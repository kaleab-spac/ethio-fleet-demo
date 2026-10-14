from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app import models  # noqa: F401  (makes sure the tables are known)
from app.deps import get_current_user
from app.models.user import User
from app.routers import (
    alerts, auth, dashboard, drivers, fuel, geofences, maintenance, positions, reports, vehicles,
)

# Create the tables in fms.db if they don't exist yet
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Fleet Management System API", version="1.1.0")

# CORS lets our React app (port 5173) talk to this backend (port 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def block_viewer_changes(
    request: Request, user: User = Depends(get_current_user)
) -> User:
    """Every endpoint needs a login. Viewers may only read (GET)."""
    if request.method != "GET" and user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user


# Login is open to everyone
app.include_router(auth.router)

# Everything else needs a valid token
protected = [Depends(block_viewer_changes)]
for r in (
    drivers.router, vehicles.router, dashboard.router, positions.router,
    geofences.router, alerts.router, maintenance.router, fuel.router, reports.router,
):
    app.include_router(r, dependencies=protected)


@app.get("/")
def root():
    return {"message": "Fleet Management System API is running"}


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "fms-backend"}