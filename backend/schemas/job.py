from __future__ import annotations

from datetime import time, datetime
from typing import Optional
from pydantic import BaseModel


class JobCreate(BaseModel):
    weekday: int       # 0=Mon … 6=Sun
    target_time: time
    facility_id: str
    class_name: str
    days_in_advance: int


class JobUpdate(BaseModel):
    weekday: Optional[int] = None
    target_time: Optional[time] = None
    facility_id: Optional[str] = None
    class_name: Optional[str] = None
    days_in_advance: Optional[int] = None


class JobResponse(BaseModel):
    id: str
    weekday: int
    target_time: time
    facility_id: str
    class_name: str
    days_in_advance: int
    enabled: bool
    created_at: datetime

    model_config = {"from_attributes": True}
