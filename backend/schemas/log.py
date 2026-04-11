from __future__ import annotations

from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel


class LogResponse(BaseModel):
    id: str
    job_id: str
    executed_at: datetime
    target_date: date
    status: str
    message: Optional[str]

    model_config = {"from_attributes": True}
