"""
Push-Benachrichtigungen für bevorstehende Termine.
"""
from __future__ import annotations

import json
import logging
import os
from datetime import datetime, timezone, timedelta

from pywebpush import webpush, WebPushException
from sqlalchemy.orm import Session

from backend.models.push_subscription import PushSubscription
from backend.models.user import User

log = logging.getLogger(__name__)

WORKER_INTERVAL_MINUTES = 15


def format_advance_time(minutes: int) -> str:
    hours, mins = divmod(minutes, 60)
    if hours > 0 and mins > 0:
        h_label = "Stunde" if hours == 1 else "Stunden"
        m_label = "Minute" if mins == 1 else "Minuten"
        return f"{hours} {h_label} {mins} {m_label}"
    if hours > 0:
        return f"{hours} {'Stunde' if hours == 1 else 'Stunden'}"
    return f"{minutes} {'Minute' if minutes == 1 else 'Minuten'}"


def _send_to_subscription(sub: PushSubscription, payload: dict, db: Session) -> None:
    try:
        webpush(
            subscription_info={
                "endpoint": sub.endpoint,
                "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
            },
            data=json.dumps(payload),
            vapid_private_key=os.environ["VAPID_PRIVATE_KEY"],
            vapid_claims={"sub": os.environ["VAPID_SUBJECT"]},
        )
    except WebPushException as exc:
        if exc.response is not None and exc.response.status_code == 410:
            log.info("Push subscription gone, removing: %s", sub.endpoint)
            db.delete(sub)
            db.commit()
        else:
            log.error("Push failed for endpoint %s: %s", sub.endpoint, exc)


def send_push_notifications(
    db: Session,
    user: User,
    bookings: list[dict],
    now: datetime,
) -> None:
    now_naive = now.replace(tzinfo=None) if now.tzinfo else now
    window_start = now_naive.replace(second=0, microsecond=0)
    window_end = window_start + timedelta(minutes=WORKER_INTERVAL_MINUTES)

    subscriptions = db.query(PushSubscription).filter_by(user_id=user.id).all()
    if not subscriptions:
        return

    log.info(
        "Push window [%s, %s) for user %s — %d bookings, advance=%d min",
        window_start, window_end, user.email, len(bookings), user.notification_advance_minutes,
    )

    for booking in bookings:
        try:
            start_dt = datetime.fromisoformat(booking["start_datetime"])
            if start_dt.tzinfo is not None:
                start_dt = start_dt.replace(tzinfo=None)
        except (ValueError, KeyError):
            continue

        notification_time = start_dt - timedelta(minutes=user.notification_advance_minutes)
        log.info("Booking %s start=%s notification_time=%s", booking.get("activity_name"), start_dt, notification_time)
        if not (window_start <= notification_time < window_end):
            continue

        advance_label = format_advance_time(user.notification_advance_minutes)
        time_str = start_dt.strftime("%H:%M")
        payload = {
            "title": f"Termin in {advance_label}",
            "body": f"{booking.get('activity_name', '')} um {time_str} Uhr · {booking.get('facility_name', '')}",
        }

        for sub in subscriptions:
            _send_to_subscription(sub, payload, db)
