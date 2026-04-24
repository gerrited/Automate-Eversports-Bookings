from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


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
    max_active_jobs: Optional[int] = Field(default=None, ge=1)


class MeResponse(BaseModel):
    total_bookings_executed: int
    max_active_jobs: Optional[int] = None

    model_config = {"from_attributes": True}
