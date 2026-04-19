from fastapi import APIRouter, Depends, Response
from sqlalchemy.orm import Session

from backend.api.deps import get_current_active_user
from backend.db import get_db
from backend.models.user import User

router = APIRouter()


@router.delete("/account", status_code=204)
def delete_account(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    db.delete(current_user)
    db.commit()
    return Response(status_code=204)
