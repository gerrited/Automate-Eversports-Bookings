from __future__ import annotations

from datetime import date, time, datetime, timezone
from typing import Optional
from pydantic import BaseModel, computed_field, field_validator

from backend.core.schedule import class_date_for_run


class JobCreate(BaseModel):
    weekday: int       # 0=Mon … 6=Sun
    target_time: time
    facility_id: str
    facility_name: str
    class_name: str
    days_in_advance: int
    one_time: bool = False
    debug: bool = False


class JobUpdate(BaseModel):
    weekday: Optional[int] = None
    target_time: Optional[time] = None
    facility_id: Optional[str] = None
    facility_name: Optional[str] = None
    class_name: Optional[str] = None
    days_in_advance: Optional[int] = None
    one_time: Optional[bool] = None
    debug: Optional[bool] = None


class JobResponse(BaseModel):
    id: str
    weekday: int
    target_time: time
    facility_id: str
    facility_name: str
    class_name: str
    days_in_advance: int
    enabled: bool
    one_time: bool
    debug: bool
    next_run_at: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_validator("next_run_at")
    @classmethod
    def _next_run_utc(cls, v: Optional[datetime]) -> Optional[datetime]:
        # SQLite liefert naive Werte (gespeichert als UTC) — immer mit Zeitzone ausliefern
        if v is None:
            return None
        return v.replace(tzinfo=timezone.utc) if v.tzinfo is None else v.astimezone(timezone.utc)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def next_class_date(self) -> Optional[date]:
        """Kurstermin, für den der nächste Lauf bucht (Vorschau im Frontend)."""
        if self.next_run_at is None:
            return None
        return class_date_for_run(self.next_run_at, self.days_in_advance)


class AdminJobResponse(JobResponse):
    user_email: str
    success_count: int
    failed_count: int
    already_booked_count: int
