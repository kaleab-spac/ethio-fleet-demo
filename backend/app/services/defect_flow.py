from datetime import datetime

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.defect import DefectHistory, DefectReport
from app.models.user import User
from app.services.notify import audit, notify_driver

# Which status may follow which
TRANSITIONS = {
    "open": {"acknowledged", "in_progress", "rejected"},
    "acknowledged": {"in_progress", "resolved", "rejected"},
    "in_progress": {"resolved"},
    "resolved": {"closed", "in_progress"},  # in_progress = reopened
    "closed": set(),
    "rejected": set(),
}

LABELS = {
    "acknowledged": "acknowledged",
    "in_progress": "in progress",
    "resolved": "resolved",
    "closed": "closed",
    "rejected": "rejected",
}


def apply_transition(
    db: Session, report: DefectReport, new_status: str, note: str | None, user: User
):
    old = report.status
    if new_status == old:
        raise HTTPException(status_code=409, detail=f"This report is already {LABELS.get(old, old)}")
    if new_status not in TRANSITIONS.get(old, set()):
        raise HTTPException(
            status_code=409,
            detail=f"A report that is {old.replace('_', ' ')} cannot become {LABELS[new_status]}",
        )

    note = (note or "").strip()
    if new_status == "resolved" and len(note) < 3:
        raise HTTPException(status_code=400, detail="Please describe how it was resolved")
    if new_status == "rejected" and len(note) < 3:
        raise HTTPException(status_code=400, detail="Please give a reason for rejecting")

    report.status = new_status
    report.updated_at = datetime.utcnow()
    if new_status in ("resolved", "rejected"):
        report.resolution = note

    name = report.vehicle_name or f"vehicle {report.vehicle_id}"
    db.add(DefectHistory(
        defect_id=report.id, actor_id=user.id,
        from_status=old, to_status=new_status, note=note or None,
    ))
    text = f"Your defect report on {name} is now: {LABELS[new_status]}."
    if note:
        text += f" Note: {note}"
    notify_driver(db, report.driver_id, "Defect report updated", text, "/driver/defects")
    audit(db, user, "defect.status_changed", "defect", report.id,
          f"{old} -> {new_status} ({name})")