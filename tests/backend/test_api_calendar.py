import uuid
from unittest.mock import patch

from backend.core.auth import create_access_token
from backend.core.encryption import encrypt
from backend.models.user import User


def _auth_header(user_id: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _create_user(db_session, *, calendar_token: str | None = None) -> User:
    user = User(
        eversports_user_id="ev-1",
        email="a@b.com",
        encrypted_password=encrypt("password123"),
        active=True,
        calendar_token=calendar_token,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_get_calendar_token_creates_on_first_call(client, db_session):
    user = _create_user(db_session)
    resp = client.get("/api/me/calendar-token", headers=_auth_header(user.id))
    assert resp.status_code == 200
    body = resp.json()
    assert "token" in body
    assert len(body["token"]) == 36  # UUID4


def test_get_calendar_token_returns_existing(client, db_session):
    existing = str(uuid.uuid4())
    user = _create_user(db_session, calendar_token=existing)
    resp = client.get("/api/me/calendar-token", headers=_auth_header(user.id))
    assert resp.status_code == 200
    assert resp.json()["token"] == existing


def test_regenerate_calendar_token_returns_new_token(client, db_session):
    old = str(uuid.uuid4())
    user = _create_user(db_session, calendar_token=old)
    resp = client.post("/api/me/calendar-token/regenerate", headers=_auth_header(user.id))
    assert resp.status_code == 200
    new_token = resp.json()["token"]
    assert new_token != old
    assert len(new_token) == 36
