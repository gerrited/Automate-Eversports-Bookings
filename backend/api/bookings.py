from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from backend.api.deps import get_current_active_user
from backend.core.booking import fetch_upcoming_bookings, cancel_booking_by_ids
from backend.core.encryption import decrypt
from backend.models.user import User

router = APIRouter()


class CancelRequest(BaseModel):
    event_id: str
    facility_id: str
    session_id: str


@router.get("/bookings/upcoming")
def get_upcoming_bookings(
    current_user: User = Depends(get_current_active_user),
):
    password = decrypt(current_user.encrypted_password)
    try:
        bookings = fetch_upcoming_bookings(current_user.email, password)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return bookings


@router.post("/bookings/{event_participant_id}/cancel", status_code=204)
def cancel_booking(
    event_participant_id: str,
    body: CancelRequest,
    current_user: User = Depends(get_current_active_user),
):
    password = decrypt(current_user.encrypted_password)
    try:
        cancel_booking_by_ids(
            email=current_user.email,
            password=password,
            event_id=body.event_id,
            event_participant_id=event_participant_id,
            facility_id=body.facility_id,
            session_id=body.session_id,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=400, detail=str(e))
