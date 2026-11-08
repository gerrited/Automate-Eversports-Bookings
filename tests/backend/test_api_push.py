import os
from backend.core.auth import create_access_token
from backend.models.user import User
from backend.models.push_subscription import PushSubscription


def _auth(user_id: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _user(db, email="u@example.com") -> User:
    u = User(eversports_user_id="ev-1", email=email, encrypted_password="x", active=True)
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def test_vapid_public_key_returns_key(client):
    os.environ["VAPID_PUBLIC_KEY"] = "test-public-key"
    resp = client.get("/api/push/vapid-public-key")
    assert resp.status_code == 200
    assert resp.json()["public_key"] == "test-public-key"


def test_subscribe_creates_subscription(client, db_session):
    user = _user(db_session)
    resp = client.post(
        "/api/push/subscribe",
        json={"endpoint": "https://example.com/push/1", "p256dh": "key1", "auth": "auth1"},
        headers=_auth(user.id),
    )
    assert resp.status_code == 204
    sub = db_session.query(PushSubscription).filter_by(endpoint="https://example.com/push/1").first()
    assert sub is not None
    assert sub.user_id == user.id


def test_subscribe_upserts_existing_endpoint(client, db_session):
    user = _user(db_session)
    for _ in range(2):
        client.post(
            "/api/push/subscribe",
            json={"endpoint": "https://example.com/push/1", "p256dh": "key1", "auth": "auth1"},
            headers=_auth(user.id),
        )
    count = db_session.query(PushSubscription).filter_by(endpoint="https://example.com/push/1").count()
    assert count == 1


def test_subscribe_requires_auth(client):
    resp = client.post(
        "/api/push/subscribe",
        json={"endpoint": "https://example.com/push/1", "p256dh": "k", "auth": "a"},
    )
    assert resp.status_code == 401


def test_unsubscribe_removes_subscription(client, db_session):
    user = _user(db_session)
    sub = PushSubscription(user_id=user.id, endpoint="https://example.com/push/2", p256dh="k", auth="a")
    db_session.add(sub)
    db_session.commit()

    resp = client.request(
        "DELETE",
        "/api/push/subscribe",
        json={"endpoint": "https://example.com/push/2"},
        headers=_auth(user.id),
    )
    assert resp.status_code == 204
    assert db_session.query(PushSubscription).filter_by(endpoint="https://example.com/push/2").first() is None


def test_unsubscribe_nonexistent_returns_204(client, db_session):
    user = _user(db_session)
    resp = client.request(
        "DELETE",
        "/api/push/subscribe",
        json={"endpoint": "https://example.com/push/999"},
        headers=_auth(user.id),
    )
    assert resp.status_code == 204
