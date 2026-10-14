from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import Base, engine
from app import models  # noqa: F401  (makes sure the tables are known)
from app.routers import (
    alerts, dashboard, drivers, fuel, geofences, maintenance, positions, reports, vehicles,
)

# Create the tables in fms.db if they don't exist yet
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Fleet Management System API", version="0.9.0")

# CORS lets our React app (port 5173) talk to this backend (port 8000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(drivers.router)
app.include_router(vehicles.router)
app.include_router(dashboard.router)
app.include_router(positions.router)
app.include_router(geofences.router)
app.include_router(alerts.router)
app.include_router(maintenance.router)
app.include_router(fuel.router)
app.include_router(reports.router)


@app.get("/")
def root():
    return {"message": "Fleet Management System API is running"}


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "fms-backend"}