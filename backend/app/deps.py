from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.security import decode_token

bearer = HTTPBearer(auto_error=False)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> User:
    """Any logged-in user. Returns 401 if the token is missing or invalid."""
    if creds is None:
        raise HTTPException(status_code=401, detail="Not logged in")
    payload = decode_token(creds.credentials)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    user = db.scalar(select(User).where(User.username == payload["sub"]))
    if user is None or not user.active:
        raise HTTPException(status_code=401, detail="User not found or disabled")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """Only admins. Returns 403 for viewers."""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return user