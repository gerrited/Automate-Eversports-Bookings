import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Boolean, Time, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.db import Base


class BookingJob(Base):
    __tablename__ = "booking_jobs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String, ForeignKey("users.id"), nullable=False)
    weekday = Column(Integer, nullable=False)   # 0=Mon … 6=Sun
    target_time = Column(Time, nullable=False)
    facility_id = Column(String, nullable=False)
    facility_name = Column(String, nullable=False, server_default='')
    class_name = Column(String, nullable=False)
    days_in_advance = Column(Integer, nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)
    one_time = Column(Boolean, default=False, nullable=False)
    debug = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="jobs")
    logs = relationship("BookingLog", back_populates="job", cascade="all, delete-orphan")
