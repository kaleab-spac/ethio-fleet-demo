from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models.user import User
from app.schemas.auth import LoginRequest, LoginResponse, UserOut
from app.security import create_token, verify_password

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/login", response_model=LoginResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.username == data.username))
    # Same message for a wrong username or a wrong password, on purpose
    if user is None or not user.active or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Wrong username or password")
    if user.status == "pending":
        raise HTTPException(status_code=403, detail="Your account is waiting for manager approval")
    if user.status != "active":
        raise HTTPException(status_code=403, detail="Your account is suspended. Contact your manager")
    return LoginResponse(access_token=create_token(user.username, user.role), user=user)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user