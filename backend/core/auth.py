import os
from datetime import datetime, timedelta, timezone

import jwt

_ALGORITHM = "HS256"
_EXPIRE_HOURS = 24

JWTError = jwt.PyJWTError  # re-exported for callers


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {"sub": user_id, "iat": now, "exp": now + timedelta(hours=_EXPIRE_HOURS)},
        _secret(),
        algorithm=_ALGORITHM,
    )


def verify_token(token: str) -> str:
    """Returns user_id. Raises jwt.PyJWTError on invalid/expired token."""
    payload = jwt.decode(token, _secret(), algorithms=[_ALGORITHM])
    user_id: str | None = payload.get("sub")
    if not user_id:
        raise jwt.PyJWTError("Token missing subject")
    return user_id
