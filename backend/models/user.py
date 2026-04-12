import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Boolean
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
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    jobs = relationship("BookingJob", back_populates="user", cascade="all, delete-orphan")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if self.active is None:
            self.active = False
        if self.role is None:
            self.role = "user"
