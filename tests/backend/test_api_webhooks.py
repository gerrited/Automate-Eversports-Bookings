import os
from datetime import time as dt_time
from unittest.mock import MagicMock, patch

from backend.core.auth import create_access_token
from backend.models.booking_job import BookingJob
from backend.models.user import User

os.environ.setdefault("STRIPE_SECRET_KEY", "sk_test_dummy")
os.environ.setdefault("STRIPE_PRICE_ID", "price_dummy")
os.environ.setdefault("STRIPE_WEBHOOK_SECRET", "whsec_test_dummy")


def _auth_header(user_id: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _create_user(db_session, *, stripe_customer_id: str | None = None, max_active_jobs: int | None = None) -> User:
    user = User(
        eversports_user_id="ev-stripe-1",
        email="stripe@example.com",
        encrypted_password="x",
        active=True,
        stripe_customer_id=stripe_customer_id,
        max_active_jobs=max_active_jobs,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _create_job(db_session, user_id: str, *, enabled: bool = True) -> BookingJob:
    job = BookingJob(
        user_id=user_id,
        weekday=1,
        target_time=dt_time(18, 0),
        facility_id="73041",
        facility_name="TestFacility",
        class_name="Yoga",
        days_in_advance=4,
        enabled=enabled,
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)
    return job


def test_checkout_returns_url(client, db_session):
    user = _create_user(db_session)
    mock_session = MagicMock()
    mock_session.url = "https://checkout.stripe.com/test-session"
    with patch("backend.api.webhooks.stripe.checkout.Session.create", return_value=mock_session):
        resp = client.post("/api/stripe/checkout", headers=_auth_header(user.id))
    assert resp.status_code == 200
    assert resp.json()["url"] == "https://checkout.stripe.com/test-session"


def test_checkout_requires_auth(client):
    resp = client.post("/api/stripe/checkout")
    assert resp.status_code in (401, 403)
