from __future__ import annotations

import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.deps import get_current_active_user
from backend.core.booking import fetch_upcoming_bookings
from backend.core.encryption import decrypt
from backend.db import get_db
from backend.models.user import User

router = APIRouter()


class CalendarTokenResponse(BaseModel):
    token: str


@router.get("/me/calendar-token", response_model=CalendarTokenResponse)
def get_calendar_token(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if current_user.calendar_token is None:
        current_user.calendar_token = str(uuid.uuid4())
        db.commit()
        db.refresh(current_user)
    return CalendarTokenResponse(token=current_user.calendar_token)


@router.post("/me/calendar-token/regenerate", response_model=CalendarTokenResponse)
def regenerate_calendar_token(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    current_user.calendar_token = str(uuid.uuid4())
    db.commit()
    db.refresh(current_user)
    return CalendarTokenResponse(token=current_user.calendar_token)


def _format_ics_dt(iso_str: str) -> str:
    try:
        return datetime.fromisoformat(iso_str).strftime("%Y%m%dT%H%M%S")
    except (ValueError, TypeError):
        return ""


def _generate_ics(bookings: list[dict]) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Eversports Bookings//DE",
        "CALSCALE:GREGORIAN",
        "X-WR-CALNAME:Meine Eversports Buchungen",
    ]
    for b in bookings:
        lines += [
            "BEGIN:VEVENT",
            f"UID:{b['event_id']}@eversports-bookings",
            f"DTSTART:{_format_ics_dt(b['start_datetime'])}",
            f"DTEND:{_format_ics_dt(b['end_datetime'])}",
            f"SUMMARY:{b['activity_name']}",
            f"LOCATION:{b['facility_name']}, {b['address']}",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines)


@router.get("/calendar/feed.ics")
def get_calendar_feed(token: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.calendar_token == token).first()
    if user is None:
        raise HTTPException(status_code=404, detail="Invalid token")

    try:
        password = decrypt(user.encrypted_password)
        bookings = fetch_upcoming_bookings(user.email, password)
    except Exception:
        bookings = []

    ics_content = _generate_ics(bookings)
    return Response(
        content=ics_content,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": 'inline; filename="eversports.ics"',
                 "Cache-Control": "no-cache, no-store"},
    )
