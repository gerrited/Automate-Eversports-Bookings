import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.db import Base


class BookingLog(Base):
    __tablename__ = "booking_logs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    job_id = Column(String, ForeignKey("booking_jobs.id"), nullable=False)
    executed_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    target_date = Column(Date, nullable=False)
    status = Column(String, nullable=False)   # success / failed / already_booked / waitlist
    message = Column(String, nullable=True)

    job = relationship("BookingJob", back_populates="logs")
