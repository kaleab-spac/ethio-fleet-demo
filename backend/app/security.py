from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

# Demo secret used to sign tokens. For a real deployment, use a long random
# value kept outside the code (for example in a .env file).
SECRET_KEY = "ethio-fleet-demo-secret-change-me-before-real-use"
ALGORITHM = "HS256"
TOKEN_HOURS = 8


def hash_password(password: str) -> str:
    """Turn a password into a hash that is safe to store."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, password_hash: str) -> bool:
    """Check a typed password against a stored hash."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


def create_token(username: str, role: str) -> str:
    payload = {
        "sub": username,
        "role": role,
        "exp": datetime.now(timezone.utc) + timedelta(hours=TOKEN_HOURS),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str):
    """Returns the token contents, or None if it is invalid or expired."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None