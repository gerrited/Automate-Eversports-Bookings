from datetime import datetime
from pydantic import BaseModel


class UserResponse(BaseModel):
    id: str
    email: str
    active: bool
    role: str
    job_count: int
    created_at: datetime

    model_config = {"from_attributes": True}


class SetActiveRequest(BaseModel):
    active: bool
