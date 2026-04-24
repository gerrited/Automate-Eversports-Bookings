import os

os.environ.setdefault("ENCRYPTION_KEY", os.urandom(32).hex())
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-do-not-use-in-prod")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")

from backend.core.auth import create_access_token
from backend.models.user import User


def _auth(user_id: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _make_user(db_session, ev_id="ev1", email="u@x.com", total=0) -> User:
    user = User(
        eversports_user_id=ev_id,
        email=email,
        encrypted_password="x",
        active=True,
        role="user",
        total_bookings_executed=total,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_me_requires_auth(client):
    resp = client.get("/api/me")
    assert resp.status_code == 401


def test_me_returns_total_bookings_executed(client, db_session):
    user = _make_user(db_session, total=5)
    resp = client.get("/api/me", headers=_auth(user.id))
    assert resp.status_code == 200
    assert resp.json()["total_bookings_executed"] == 5


def test_me_returns_zero_when_no_bookings(client, db_session):
    user = _make_user(db_session, total=0)
    resp = client.get("/api/me", headers=_auth(user.id))
    assert resp.status_code == 200
    assert resp.json()["total_bookings_executed"] == 0
