import os
from datetime import datetime, timedelta, timezone

import jwt

_ALGORITHM = "HS256"
_ACCESS_EXPIRE_MINUTES = 15
_REFRESH_EXPIRE_DAYS = 90

JWTError = jwt.PyJWTError  # re-exported for callers


def _secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": user_id,
            "type": "access",
            "iat": now,
            "exp": now + timedelta(minutes=_ACCESS_EXPIRE_MINUTES),
        },
        _secret(),
        algorithm=_ALGORITHM,
    )


def create_refresh_token(user_id: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": user_id,
            "type": "refresh",
            "iat": now,
            "exp": now + timedelta(days=_REFRESH_EXPIRE_DAYS),
        },
        _secret(),
        algorithm=_ALGORITHM,
    )


def verify_token(token: str) -> str:
    """Returns user_id. Raises jwt.PyJWTError on invalid/expired/wrong-type token."""
    payload = jwt.decode(token, _secret(), algorithms=[_ALGORITHM])
    if payload.get("type") != "access":
        raise jwt.PyJWTError("Token is not an access token")
    user_id: str | None = payload.get("sub")
    if not user_id:
        raise jwt.PyJWTError("Token missing subject")
    return user_id


def verify_refresh_token(token: str) -> str:
    """Returns user_id. Raises jwt.PyJWTError on invalid/expired/wrong-type token."""
    payload = jwt.decode(token, _secret(), algorithms=[_ALGORITHM])
    if payload.get("type") != "refresh":
        raise jwt.PyJWTError("Token is not a refresh token")
    user_id: str | None = payload.get("sub")
    if not user_id:
        raise jwt.PyJWTError("Token missing subject")
    return user_id
