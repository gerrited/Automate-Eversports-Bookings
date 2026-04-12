from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.api.deps import require_admin
from backend.db import get_db
from backend.models.user import User
from backend.schemas.user import UserResponse, SetActiveRequest

router = APIRouter()


@router.get("/admin/users", response_model=List[UserResponse])
def list_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    return db.query(User).order_by(User.created_at).all()


@router.patch("/admin/users/{user_id}/active", response_model=UserResponse)
def set_user_active(
    user_id: str,
    body: SetActiveRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    if user_id == current_user.id and not body.active:
        raise HTTPException(status_code=400, detail="Cannot deactivate your own account")
    user.active = body.active
    db.commit()
    db.refresh(user)
    return user
