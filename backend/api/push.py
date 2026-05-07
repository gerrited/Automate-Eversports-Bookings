import os

from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from backend.api.deps import get_current_active_user
from backend.db import get_db
from backend.models.push_subscription import PushSubscription
from backend.models.user import User
from backend.schemas.push import VapidPublicKeyResponse, SubscribeRequest, UnsubscribeRequest

router = APIRouter()


@router.get("/push/vapid-public-key", response_model=VapidPublicKeyResponse)
def get_vapid_public_key():
    return {"public_key": os.environ.get("VAPID_PUBLIC_KEY", "")}


@router.post("/push/subscribe", status_code=204)
def subscribe(
    body: SubscribeRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    existing = db.query(PushSubscription).filter_by(endpoint=body.endpoint).first()
    if existing:
        existing.p256dh = body.p256dh
        existing.auth = body.auth
    else:
        db.add(PushSubscription(
            user_id=current_user.id,
            endpoint=body.endpoint,
            p256dh=body.p256dh,
            auth=body.auth,
        ))
    db.commit()
    return Response(status_code=204)


@router.delete("/push/subscribe", status_code=204)
def unsubscribe(
    body: UnsubscribeRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    db.query(PushSubscription).filter_by(
        endpoint=body.endpoint, user_id=current_user.id
    ).delete()
    db.commit()
    return Response(status_code=204)
