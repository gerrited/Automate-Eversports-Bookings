from __future__ import annotations

import logging
import os
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.deps import get_current_active_user
from backend.core.email import send_subscription_activated_email, send_subscription_cancelled_email
from backend.db import get_db
from backend.models.booking_job import BookingJob
from backend.models.user import User

log = logging.getLogger(__name__)
router = APIRouter()


class CheckoutResponse(BaseModel):
    url: str


@router.post("/stripe/checkout", response_model=CheckoutResponse)
def create_checkout(
    current_user: User = Depends(get_current_active_user),
):
    stripe.api_key = os.environ["STRIPE_SECRET_KEY"]
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
    price_id = os.environ["STRIPE_PRICE_ID"]
    session = stripe.checkout.Session.create(
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=f"{frontend_url}/dashboard?checkout=success",
        cancel_url=f"{frontend_url}/dashboard?checkout=cancelled",
        client_reference_id=current_user.id,
    )
    return CheckoutResponse(url=session.url)


@router.post("/stripe/webhook", status_code=200)
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    raw_body = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    webhook_secret = os.environ["STRIPE_WEBHOOK_SECRET"]
    try:
        event = stripe.Webhook.construct_event(raw_body, sig_header, webhook_secret)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")
    obj = event["data"]["object"]
    if event["type"] == "checkout.session.completed":
        _handle_checkout_completed(obj, db)
    elif event["type"] == "invoice.paid":
        _handle_invoice_paid(obj, db)
    elif event["type"] == "customer.subscription.deleted":
        _handle_subscription_deleted(obj, db)
    return {"received": True}


def _handle_checkout_completed(obj: dict, db: Session) -> None:
    user_id = obj.get("client_reference_id")
    stripe_customer_id = obj.get("customer")
    if not user_id or not stripe_customer_id:
        log.warning("checkout.session.completed: missing client_reference_id or customer")
        return
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        log.warning("checkout.session.completed: user not found for id %s", user_id)
        return
    user.stripe_customer_id = stripe_customer_id
    db.commit()


def _handle_invoice_paid(obj: dict, db: Session) -> None:
    stripe_customer_id = obj.get("customer")
    user = db.query(User).filter(User.stripe_customer_id == stripe_customer_id).first()
    if user is None:
        log.warning("invoice.paid: user not found for stripe_customer_id %s", stripe_customer_id)
        return
    user.max_active_jobs = None
    db.commit()
    lines = obj.get("lines", {}).get("data", [])
    plan_name = lines[0].get("description", "") if lines else ""
    amount = obj.get("amount_paid", 0) / 100
    period_end_ts = lines[0].get("period", {}).get("end") if lines else None
    subscription_end = (
        datetime.fromtimestamp(period_end_ts, tz=timezone.utc).strftime("%d.%m.%Y")
        if period_end_ts else ""
    )
    send_subscription_activated_email(
        user.email,
        plan_name=plan_name,
        amount=amount,
        subscription_end=subscription_end,
    )


def _handle_subscription_deleted(obj: dict, db: Session) -> None:
    stripe_customer_id = obj.get("customer")
    user = db.query(User).filter(User.stripe_customer_id == stripe_customer_id).first()
    if user is None:
        log.warning("customer.subscription.deleted: user not found for stripe_customer_id %s", stripe_customer_id)
        return
    jobs = db.query(BookingJob).filter(
        BookingJob.user_id == user.id,
        BookingJob.enabled == True,
    ).all()
    deactivated_count = len(jobs)
    for job in jobs:
        job.enabled = False
    user.max_active_jobs = 1
    db.commit()
    cancelled_at_ts = obj.get("canceled_at") or obj.get("current_period_end")
    cancelled_at = (
        datetime.fromtimestamp(cancelled_at_ts, tz=timezone.utc).strftime("%d.%m.%Y")
        if cancelled_at_ts else ""
    )
    send_subscription_cancelled_email(
        user.email,
        cancelled_at=cancelled_at,
        deactivated_jobs_count=deactivated_count,
    )
