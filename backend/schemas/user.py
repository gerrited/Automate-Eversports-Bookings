from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class UserResponse(BaseModel):
    id: str
    email: str
    active: bool
    role: str
    job_count: int
    active_job_count: int
    max_active_jobs: Optional[int] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class SetActiveRequest(BaseModel):
    active: bool


class SetLimitRequest(BaseModel):
    max_active_jobs: Optional[int] = None


class MeResponse(BaseModel):
    total_bookings_executed: int

    model_config = {"from_attributes": True}
