import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Boolean, Integer
from sqlalchemy.orm import relationship
from backend.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    eversports_user_id = Column(String, unique=True, nullable=False)
    email = Column(String, unique=True, nullable=False)
    encrypted_password = Column(String, nullable=False)
    active = Column(Boolean, default=False, nullable=False)
    role = Column(String, default="user", nullable=False)
    max_active_jobs = Column(Integer, nullable=True)
    total_bookings_executed = Column(Integer, default=0, nullable=False)
    stripe_customer_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    jobs = relationship("BookingJob", back_populates="user", cascade="all, delete-orphan")
