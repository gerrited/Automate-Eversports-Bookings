import os
from datetime import datetime, timedelta, timezone

from jose import jwt, JWTError  # noqa: F401 — re-exported for callers

_ALGORITHM = "HS256"
_EXPIRE_HOURS = 24


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=_EXPIRE_HOURS)
    return jwt.encode({"sub": user_id, "exp": expire}, _secret(), algorithm=_ALGORITHM)


def verify_token(token: str) -> str:
    """Returns user_id. Raises jose.JWTError on invalid/expired token."""
    payload = jwt.decode(token, _secret(), algorithms=[_ALGORITHM])
    user_id: str | None = payload.get("sub")
    if not user_id:
        raise JWTError("Token missing subject")
    return user_id
