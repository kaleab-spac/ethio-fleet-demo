from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_admin
from app.models.driver import Driver
from app.models.user import User
from app.schemas.auth import DriverAccountCreate, UserAdminOut
from app.security import hash_password

# Every endpoint here is for admins only
router = APIRouter(prefix="/api/users", tags=["Users"], dependencies=[Depends(require_admin)])


@router.get("/", response_model=list[UserAdminOut])
def list_users(db: Session = Depends(get_db)):
    return db.scalars(select(User).order_by(User.id)).all()


@router.post("/driver-account", response_model=UserAdminOut, status_code=201)
def create_driver_account(data: DriverAccountCreate, db: Session = Depends(get_db)):
    driver = db.get(Driver, data.driver_id)
    if driver is None:
        raise HTTPException(status_code=400, detail="Driver does not exist")
    if db.scalar(select(User).where(User.username == data.username)):
        raise HTTPException(status_code=400, detail="Username already exists")
    if db.scalar(select(User).where(User.driver_id == data.driver_id)):
        raise HTTPException(status_code=400, detail="This driver already has an account")
    user = User(
        username=data.username,
        full_name=driver.full_name,
        role="driver",
        password_hash=hash_password(data.password),
        status="active",
        driver_id=driver.id,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _set_status(user_id: int, status: str, current: User, db: Session) -> User:
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user.id == current.id and status != "active":
        raise HTTPException(status_code=400, detail="You cannot suspend your own account")
    user.status = status
    db.commit()
    db.refresh(user)
    return user


@router.put("/{user_id}/approve", response_model=UserAdminOut)
def approve(user_id: int, current: User = Depends(require_admin), db: Session = Depends(get_db)):
    return _set_status(user_id, "active", current, db)


@router.put("/{user_id}/suspend", response_model=UserAdminOut)
def suspend(user_id: int, current: User = Depends(require_admin), db: Session = Depends(get_db)):
    return _set_status(user_id, "suspended", current, db)