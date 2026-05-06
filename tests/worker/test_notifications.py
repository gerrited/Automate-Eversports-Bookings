import json
import os
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

os.environ.setdefault("VAPID_PRIVATE_KEY", "test-private-key")
os.environ.setdefault("VAPID_PUBLIC_KEY", "test-public-key")
os.environ.setdefault("VAPID_SUBJECT", "mailto:test@example.com")

from backend.db import Base
from backend.models.user import User
from backend.models.push_subscription import PushSubscription
from worker.notifications import format_advance_time, send_push_notifications


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


# --- format_advance_time ---

def test_format_advance_time_hours_and_minutes():
    assert format_advance_time(90) == "1 Stunde 30 Minuten"


def test_format_advance_time_exact_hours():
    assert format_advance_time(120) == "2 Stunden"


def test_format_advance_time_one_hour():
    assert format_advance_time(60) == "1 Stunde"


def test_format_advance_time_minutes_only():
    assert format_advance_time(30) == "30 Minuten"


def test_format_advance_time_one_minute():
    assert format_advance_time(1) == "1 Minute"


# --- send_push_notifications ---

def _make_user(db, advance=60) -> User:
    u = User(
        eversports_user_id="ev-1",
        email="u@example.com",
        encrypted_password="enc",
        active=True,
        notification_advance_minutes=advance,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


def _make_subscription(db, user_id: str) -> PushSubscription:
    sub = PushSubscription(
        user_id=user_id,
        endpoint="https://push.example.com/1",
        p256dh="p256dh_key",
        auth="auth_key",
    )
    db.add(sub)
    db.commit()
    return sub


def test_sends_notification_when_booking_in_window(db_session):
    user = _make_user(db_session, advance=60)
    _make_subscription(db_session, user.id)

    now = datetime(2026, 5, 6, 9, 0, tzinfo=timezone.utc)
    # start_datetime in 60 min = 10:00 → notification_time = 09:00 → im Fenster [09:00, 09:15)
    bookings = [{"start_datetime": "2026-05-06T10:00:00", "activity_name": "Yoga", "facility_name": "FitX"}]

    with patch("worker.notifications.webpush") as mock_wp:
        send_push_notifications(db_session, user, bookings, now)
        assert mock_wp.call_count == 1
        call_kwargs = mock_wp.call_args[1]
        data = json.loads(call_kwargs["data"])
        assert "1 Stunde" in data["title"]
        assert "Yoga" in data["body"]
        assert "FitX" in data["body"]


def test_no_notification_when_booking_outside_window(db_session):
    user = _make_user(db_session, advance=60)
    _make_subscription(db_session, user.id)

    now = datetime(2026, 5, 6, 9, 0, tzinfo=timezone.utc)
    # Termin in 2 Stunden → notification_time = 10:00 → außerhalb [09:00, 09:15)
    bookings = [{"start_datetime": "2026-05-06T11:00:00", "activity_name": "Yoga", "facility_name": "FitX"}]

    with patch("worker.notifications.webpush") as mock_wp:
        send_push_notifications(db_session, user, bookings, now)
        assert mock_wp.call_count == 0


def test_deletes_gone_subscription(db_session):
    from pywebpush import WebPushException
    user = _make_user(db_session, advance=60)
    _make_subscription(db_session, user.id)

    now = datetime(2026, 5, 6, 9, 0, tzinfo=timezone.utc)
    bookings = [{"start_datetime": "2026-05-06T10:00:00", "activity_name": "Yoga", "facility_name": "FitX"}]

    gone_exc = WebPushException("Gone")
    gone_exc.response = MagicMock(status_code=410)

    with patch("worker.notifications.webpush", side_effect=gone_exc):
        send_push_notifications(db_session, user, bookings, now)

    db_session.expire_all()
    assert db_session.query(PushSubscription).filter_by(user_id=user.id).count() == 0
