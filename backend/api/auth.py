from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.core.booking import eversports_login
from backend.core.encryption import encrypt
from backend.core.auth import create_access_token
from backend.db import get_db
from backend.models.user import User
from backend.schemas.auth import LoginRequest, TokenResponse

router = APIRouter()


@router.post("/auth/login", response_model=TokenResponse)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    result = eversports_login(req.email, req.password)
    if result is None:
        raise HTTPException(status_code=401, detail="Invalid Eversports credentials")

    eversports_user_id: str = result["user_id"]
    encrypted_pw = encrypt(req.password)

    user = db.query(User).filter(User.eversports_user_id == eversports_user_id).first()
    if user is None:
        is_first_user = db.query(User).count() == 0
        user = User(
            eversports_user_id=eversports_user_id,
            email=req.email,
            encrypted_password=encrypted_pw,
            active=is_first_user,
            role="admin" if is_first_user else "user",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        if not user.active:
            raise HTTPException(status_code=403, detail="Account nicht freigegeben")
    else:
        if not user.active:
            raise HTTPException(status_code=403, detail="Account nicht freigegeben")
        user.encrypted_password = encrypted_pw
        db.commit()
        db.refresh(user)

    return TokenResponse(access_token=create_access_token(user.id), role=user.role)
