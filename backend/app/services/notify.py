from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.audit import AuditLog
from app.models.notification import Notification
from app.models.user import User


def notify_user(db: Session, user_id: int, title: str, message: str, link: str | None = None):
    db.add(Notification(user_id=user_id, title=title[:150], message=message[:500], link=link))


def notify_admins(db: Session, title: str, message: str, link: str | None = None):
    """Notify every active admin account."""
    ids = db.scalars(
        select(User.id).where(
            User.role == "admin", User.status == "active", User.active.is_(True)
        )
    ).all()
    for uid in ids:
        notify_user(db, uid, title, message, link)


def notify_driver(db: Session, driver_id: int, title: str, message: str, link: str | None = None):
    """Notify the login account(s) linked to a driver record."""
    ids = db.scalars(
        select(User.id).where(User.driver_id == driver_id, User.status == "active")
    ).all()
    for uid in ids:
        notify_user(db, uid, title, message, link)


def audit(
    db: Session,
    actor: User | None,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    details: str | None = None,
):
    db.add(AuditLog(
        actor_user_id=actor.id if actor else None,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details[:500] if details else None,
    ))