from __future__ import annotations

from datetime import date, datetime, time
from typing import List, Optional
from pydantic import BaseModel


class LogResponse(BaseModel):
    id: str
    job_id: str
    executed_at: datetime
    target_date: date
    status: str
    message: Optional[str]

    model_config = {"from_attributes": True}


class AdminLogResponse(BaseModel):
    id: str
    job_id: str
    executed_at: datetime
    target_date: date
    status: str
    message: Optional[str]
    class_name: str
    facility_name: str
    target_time: time
    weekday: int
    debug: bool
    user_email: str


class AdminLogsPage(BaseModel):
    items: List[AdminLogResponse]
    total: int
    page: int
    page_size: int
