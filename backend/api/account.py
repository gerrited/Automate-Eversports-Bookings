from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from backend.api.deps import get_current_active_user
from backend.db import get_db
from backend.models.user import User
from backend.schemas.user import MeResponse, UpdateAccountRequest

router = APIRouter()


@router.get("/me", response_model=MeResponse)
def get_me(current_user: User = Depends(get_current_active_user)):
    return current_user


@router.put("/account", response_model=MeResponse)
def update_account(
    body: UpdateAccountRequest,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    if body.notification_advance_minutes is not None:
        current_user.notification_advance_minutes = body.notification_advance_minutes
    db.commit()
    db.refresh(current_user)
    return current_user


@router.delete("/account", status_code=204)
def delete_account(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    db.delete(current_user)
    db.commit()
    return Response(status_code=204)
