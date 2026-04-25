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


# Task 4: Webhook signature verification

def test_webhook_invalid_signature(client):
    import stripe as stripe_lib
    with patch("backend.api.webhooks.stripe.Webhook.construct_event") as mock_event:
        mock_event.side_effect = stripe_lib.error.SignatureVerificationError(
            "No signatures found", "stripe-signature"
        )
        resp = client.post(
            "/api/stripe/webhook",
            content=b"{}",
            headers={"stripe-signature": "invalid"},
        )
    assert resp.status_code == 400


def test_webhook_unknown_event_returns_200(client):
    with patch("backend.api.webhooks.stripe.Webhook.construct_event") as mock_event:
        mock_event.return_value = {"type": "some.unknown.event", "data": {"object": {}}}
        resp = client.post(
            "/api/stripe/webhook",
            content=b"{}",
            headers={"stripe-signature": "valid"},
        )
    assert resp.status_code == 200
    assert resp.json() == {"received": True}


# Task 5: checkout.session.completed handler

def test_checkout_session_completed_saves_customer_id(client, db_session):
    user = _create_user(db_session)
    event_obj = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "client_reference_id": user.id,
                "customer": "cus_test_123",
            }
        },
    }
    with patch("backend.api.webhooks.stripe.Webhook.construct_event", return_value=event_obj):
        resp = client.post(
            "/api/stripe/webhook",
            content=b"{}",
            headers={"stripe-signature": "valid"},
        )
    assert resp.status_code == 200
    db_session.refresh(user)
    assert user.stripe_customer_id == "cus_test_123"


def test_checkout_session_completed_unknown_user_returns_200(client, db_session):
    event_obj = {
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "client_reference_id": "nonexistent-user-id",
                "customer": "cus_test_456",
            }
        },
    }
    with patch("backend.api.webhooks.stripe.Webhook.construct_event", return_value=event_obj):
        resp = client.post(
            "/api/stripe/webhook",
            content=b"{}",
            headers={"stripe-signature": "valid"},
        )
    assert resp.status_code == 200


# Task 6: invoice.paid handler

def test_invoice_paid_sets_unlimited_jobs(client, db_session):
    user = _create_user(db_session, stripe_customer_id="cus_test_123", max_active_jobs=1)
    event_obj = {
        "type": "invoice.paid",
        "data": {
            "object": {
                "customer": "cus_test_123",
                "amount_paid": 999,
                "lines": {
                    "data": [{
                        "description": "Pro Monatlich",
                        "period": {"end": 1748044800},
                    }]
                },
            }
        },
    }
    with patch("backend.api.webhooks.stripe.Webhook.construct_event", return_value=event_obj):
        with patch("backend.api.webhooks.send_subscription_activated_email") as mock_mail:
            resp = client.post(
                "/api/stripe/webhook",
                content=b"{}",
                headers={"stripe-signature": "valid"},
            )
    assert resp.status_code == 200
    db_session.refresh(user)
    assert user.max_active_jobs is None
    mock_mail.assert_called_once_with(
        "stripe@example.com",
        plan_name="Pro Monatlich",
        amount=9.99,
        subscription_end="24.05.2025",
    )


def test_invoice_paid_unknown_customer_returns_200(client, db_session):
    event_obj = {
        "type": "invoice.paid",
        "data": {
            "object": {
                "customer": "cus_unknown",
                "amount_paid": 0,
                "lines": {"data": []},
            }
        },
    }
    with patch("backend.api.webhooks.stripe.Webhook.construct_event", return_value=event_obj):
        resp = client.post(
            "/api/stripe/webhook",
            content=b"{}",
            headers={"stripe-signature": "valid"},
        )
    assert resp.status_code == 200


# Task 7: customer.subscription.deleted handler

def test_subscription_deleted_deactivates_jobs_and_sets_limit(client, db_session):
    user = _create_user(db_session, stripe_customer_id="cus_test_123")
    job1 = _create_job(db_session, user.id, enabled=True)
    job2 = _create_job(db_session, user.id, enabled=True)
    _create_job(db_session, user.id, enabled=False)

    event_obj = {
        "type": "customer.subscription.deleted",
        "data": {
            "object": {
                "customer": "cus_test_123",
                "canceled_at": 1745452800,
            }
        },
    }
    with patch("backend.api.webhooks.stripe.Webhook.construct_event", return_value=event_obj):
        with patch("backend.api.webhooks.send_subscription_cancelled_email") as mock_mail:
            resp = client.post(
                "/api/stripe/webhook",
                content=b"{}",
                headers={"stripe-signature": "valid"},
            )
    assert resp.status_code == 200
    db_session.refresh(user)
    db_session.refresh(job1)
    db_session.refresh(job2)
    assert user.max_active_jobs == 1
    assert job1.enabled is False
    assert job2.enabled is False
    mock_mail.assert_called_once_with(
        "stripe@example.com",
        cancelled_at="24.04.2025",
        deactivated_jobs_count=2,
    )


def test_subscription_deleted_no_enabled_jobs(client, db_session):
    user = _create_user(db_session, stripe_customer_id="cus_test_123")
    _create_job(db_session, user.id, enabled=False)

    event_obj = {
        "type": "customer.subscription.deleted",
        "data": {
            "object": {
                "customer": "cus_test_123",
                "canceled_at": 1745452800,
            }
        },
    }
    with patch("backend.api.webhooks.stripe.Webhook.construct_event", return_value=event_obj):
        with patch("backend.api.webhooks.send_subscription_cancelled_email") as mock_mail:
            resp = client.post(
                "/api/stripe/webhook",
                content=b"{}",
                headers={"stripe-signature": "valid"},
            )
    assert resp.status_code == 200
    db_session.refresh(user)
    assert user.max_active_jobs == 1
    mock_mail.assert_called_once_with(
        "stripe@example.com",
        cancelled_at="24.04.2025",
        deactivated_jobs_count=0,
    )


def test_subscription_deleted_unknown_customer_returns_200(client, db_session):
    event_obj = {
        "type": "customer.subscription.deleted",
        "data": {"object": {"customer": "cus_unknown", "canceled_at": None}},
    }
    with patch("backend.api.webhooks.stripe.Webhook.construct_event", return_value=event_obj):
        resp = client.post(
            "/api/stripe/webhook",
            content=b"{}",
            headers={"stripe-signature": "valid"},
        )
    assert resp.status_code == 200
