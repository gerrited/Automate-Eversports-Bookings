from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from backend.api.deps import get_current_active_user
from backend.db import get_db
from backend.models.user import User
from backend.schemas.user import MeResponse

router = APIRouter()


@router.get("/me", response_model=MeResponse)
def get_me(current_user: User = Depends(get_current_active_user)):
    return MeResponse(
        email=current_user.email,
        role=current_user.role,
        subscription_active=current_user.max_active_jobs is None,
        total_bookings_executed=current_user.total_bookings_executed,
        max_active_jobs=current_user.max_active_jobs,
    )


@router.delete("/account", status_code=204)
def delete_account(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    db.delete(current_user)
    db.commit()
    return Response(status_code=204)
