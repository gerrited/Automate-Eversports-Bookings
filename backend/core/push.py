from __future__ import annotations

import json
import logging
import os

from pywebpush import webpush, WebPushException
from sqlalchemy.orm import Session

from backend.models.push_subscription import PushSubscription

log = logging.getLogger(__name__)

_TEST_PAYLOAD = {"title": "Test", "body": "Testnachricht vom Admin"}


def send_to_subscription(sub: PushSubscription, payload: dict, db: Session) -> None:
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


def send_test_push_to_user(db: Session, user_id: str) -> int:
    subscriptions = db.query(PushSubscription).filter_by(user_id=user_id).all()
    for sub in subscriptions:
        send_to_subscription(sub, _TEST_PAYLOAD, db)
    return len(subscriptions)
