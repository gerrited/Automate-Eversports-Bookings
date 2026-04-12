from datetime import datetime
from pydantic import BaseModel


class UserResponse(BaseModel):
    id: str
    email: str
    active: bool
    role: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SetActiveRequest(BaseModel):
    active: bool
