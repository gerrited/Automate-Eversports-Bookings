import logging

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response
from sqlalchemy.orm import Session

from backend.core.auth import (
    create_access_token,
    create_refresh_token,
    verify_refresh_token,
    JWTError,
)
from backend.eversports import eversports_login
from backend.core.email import send_new_user_notification
from backend.core.encryption import encrypt
from backend.core.rate_limit import RateLimiter
from backend.db import get_db
from backend.models.user import User
from backend.schemas.auth import LoginRequest, RefreshResponse, TokenResponse

log = logging.getLogger(__name__)

router = APIRouter()

# Login proxied Credentials live an Eversports — strenges Limit als
# Brute-Force-Bremse und damit Eversports unsere Server-IP nicht sperrt.
login_limiter = RateLimiter(max_requests=10, window_seconds=300)

_REFRESH_COOKIE = "refresh_token"
_REFRESH_MAX_AGE = 90 * 24 * 60 * 60  # 90 Tage
_REFRESH_PATH = "/api/auth/refresh"


def _set_refresh_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=_REFRESH_COOKIE,
        value=token,
        httponly=True,
        secure=True,
        samesite="lax",
        path=_REFRESH_PATH,
        max_age=_REFRESH_MAX_AGE,
    )


def _client_ip(request: Request) -> str:
    # nginx setzt X-Forwarded-For; ohne Proxy fällt es auf die Socket-IP zurück
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


@router.post("/auth/login", response_model=TokenResponse)
def login(req: LoginRequest, request: Request, response: Response, db: Session = Depends(get_db)):
    if not login_limiter.allow(_client_ip(request)):
        raise HTTPException(status_code=429, detail="Zu viele Login-Versuche. Bitte später erneut versuchen.")

    result = eversports_login(req.email, req.password)
    if result is None:
        raise HTTPException(status_code=401, detail="Invalid Eversports credentials")

    eversports_user_id: str = result["user_id"]
    encrypted_pw = encrypt(req.password, aad=eversports_user_id)

    user = db.query(User).filter(User.eversports_user_id == eversports_user_id).first()
    if user is None:
        is_first_user = db.query(User).count() == 0
        user = User(
            eversports_user_id=eversports_user_id,
            email=req.email,
            encrypted_password=encrypted_pw,
            active=is_first_user,
            role="admin" if is_first_user else "user",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        if not is_first_user:
            admins = db.query(User).filter(User.role == "admin", User.active == True).all()
            try:
                send_new_user_notification([a.email for a in admins], req.email)
            except Exception as exc:
                log.error("Failed to send new user notification: %s", exc)
        if not user.active:
            raise HTTPException(status_code=403, detail="Account nicht freigegeben")
    else:
        if not user.active:
            raise HTTPException(status_code=403, detail="Account nicht freigegeben")
        user.encrypted_password = encrypted_pw
        db.commit()
        db.refresh(user)

    _set_refresh_cookie(response, create_refresh_token(user.id))
    return TokenResponse(
        access_token=create_access_token(user.id),
        role=user.role,
        avatar_url=result.get("avatar_url"),
    )


@router.post("/auth/refresh", response_model=RefreshResponse)
def refresh(
    db: Session = Depends(get_db),
    refresh_token: str | None = Cookie(alias="refresh_token", default=None),
):
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Missing refresh token")
    try:
        user_id = verify_refresh_token(refresh_token)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.active:
        raise HTTPException(status_code=403, detail="Account nicht freigegeben")
    return RefreshResponse(access_token=create_access_token(user.id))


@router.post("/auth/logout", status_code=204)
def logout(response: Response):
    response.delete_cookie(
        key=_REFRESH_COOKIE,
        path=_REFRESH_PATH,
        httponly=True,
        secure=True,
        samesite="lax",
    )
