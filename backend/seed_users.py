from sqlalchemy import select

from app.database import Base, SessionLocal, engine
from app.models import User
from app.security import hash_password, verify_password

Base.metadata.create_all(bind=engine)

USERS = [
    {"username": "kaleab", "full_name": "Kaleab Getnet", "role": "admin", "password": "Time"},
    {"username": "viewer", "full_name": "Demo Viewer", "role": "viewer", "password": "View2026"},
]


def main():
    db = SessionLocal()
    added = 0
    try:
        for u in USERS:
            if db.scalar(select(User).where(User.username == u["username"])):
                continue
            db.add(User(
                username=u["username"],
                full_name=u["full_name"],
                role=u["role"],
                password_hash=hash_password(u["password"]),
            ))
            added += 1
        db.commit()

        # Quick self-check: the stored hash must match the right password only
        admin = db.scalar(select(User).where(User.username == "kaleab"))
        print("Right password accepted:", verify_password("Time", admin.password_hash))
        print("Wrong password accepted:", verify_password("time", admin.password_hash))
    finally:
        db.close()
    print(f"Done. Added {added} users.")


if __name__ == "__main__":
    main()