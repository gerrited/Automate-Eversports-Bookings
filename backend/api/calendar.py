from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.api.deps import get_current_active_user
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
