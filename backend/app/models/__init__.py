from app.models.driver import Driver
from app.models.vehicle import Vehicle
from app.models.position import Position
from app.models.geofence import Geofence
from app.models.alert import Alert
from app.models.maintenance import Maintenance
from app.models.fuel import FuelLog
from app.models.user import User
from app.models.defect import DefectReport

__all__ = [
    "Driver", "Vehicle", "Position", "Geofence", "Alert", "Maintenance", "FuelLog",
    "User", "DefectReport",
]