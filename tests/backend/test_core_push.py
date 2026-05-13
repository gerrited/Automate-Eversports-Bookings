import json
import os
from unittest.mock import patch, MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("VAPID_PRIVATE_KEY", "test-private-key")
os.environ.setdefault("VAPID_SUBJECT", "mailto:test@example.com")
os.environ.setdefault("ENCRYPTION_KEY", os.urandom(32).hex())
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-do-not-use-in-prod")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")

from backend.db import Base
from backend.models.push_subscription import PushSubscription
from backend.models.user import User
from backend.core.push import send_to_subscription, send_test_push_to_user


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    Base.metadata.drop_all(engine)


def _make_user(db) -> User:
    u = User(
        eversports_user_id="ev-1",
        email="u@example.com",
        encrypted_password="enc",
        active=True,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _make_sub(db, user_id: str, endpoint: str = "https://push.example.com/1") -> PushSubscription:
    sub = PushSubscription(user_id=user_id, endpoint=endpoint, p256dh="k", auth="a")
    db.add(sub)
    db.commit()
    return sub


def test_send_to_subscription_calls_webpush(db_session):
    user = _make_user(db_session)
    sub = _make_sub(db_session, user.id)
    with patch("backend.core.push.webpush") as mock_wp:
        send_to_subscription(sub, {"title": "T", "body": "B"}, db_session)
    assert mock_wp.call_count == 1
    call_kwargs = mock_wp.call_args[1]
    assert call_kwargs["subscription_info"]["endpoint"] == sub.endpoint
    data = json.loads(call_kwargs["data"])
    assert data == {"title": "T", "body": "B"}


def test_send_to_subscription_removes_gone_subscription(db_session):
    from pywebpush import WebPushException
    user = _make_user(db_session)
    sub = _make_sub(db_session, user.id)
    exc = WebPushException("Gone")
    exc.response = MagicMock(status_code=410)
    with patch("backend.core.push.webpush", side_effect=exc):
        send_to_subscription(sub, {"title": "T", "body": "B"}, db_session)
    db_session.expire_all()
    assert db_session.query(PushSubscription).filter_by(user_id=user.id).count() == 0


def test_send_to_subscription_does_not_remove_on_other_errors(db_session):
    from pywebpush import WebPushException
    user = _make_user(db_session)
    sub = _make_sub(db_session, user.id)
    exc = WebPushException("Server Error")
    exc.response = MagicMock(status_code=500)
    with patch("backend.core.push.webpush", side_effect=exc):
        send_to_subscription(sub, {"title": "T", "body": "B"}, db_session)
    db_session.expire_all()
    assert db_session.query(PushSubscription).filter_by(user_id=user.id).count() == 1


def test_send_test_push_to_user_sends_to_all_subscriptions(db_session):
    user = _make_user(db_session)
    _make_sub(db_session, user.id, endpoint="https://push.example.com/1")
    _make_sub(db_session, user.id, endpoint="https://push.example.com/2")
    with patch("backend.core.push.webpush") as mock_wp:
        count = send_test_push_to_user(db_session, user.id)
    assert mock_wp.call_count == 2
    assert count == 2


def test_send_test_push_to_user_uses_correct_payload(db_session):
    user = _make_user(db_session)
    _make_sub(db_session, user.id)
    with patch("backend.core.push.webpush") as mock_wp:
        send_test_push_to_user(db_session, user.id)
    data = json.loads(mock_wp.call_args[1]["data"])
    assert data == {"title": "Test", "body": "Testnachricht vom Admin"}


def test_send_test_push_to_user_returns_zero_for_no_subscriptions(db_session):
    user = _make_user(db_session)
    with patch("backend.core.push.webpush") as mock_wp:
        count = send_test_push_to_user(db_session, user.id)
    assert count == 0
    assert mock_wp.call_count == 0
