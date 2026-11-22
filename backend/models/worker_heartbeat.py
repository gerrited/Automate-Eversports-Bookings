from sqlalchemy import Column, DateTime, Integer, String

from backend.db import Base


class WorkerHeartbeat(Base):
    """Lebenszeichen des Booking-Workers (eine Zeile, id = "worker").

    Der Worker schreibt last_started_at/last_finished_at bei jedem Lauf; das
    Backend prüft periodisch, ob der letzte Start zu lange her ist, und
    alarmiert dann einmalig die Admins (alert_sent_at).
    """
    __tablename__ = "worker_heartbeats"

    id = Column(String, primary_key=True)
    last_started_at = Column(DateTime(timezone=True), nullable=True)
    last_finished_at = Column(DateTime(timezone=True), nullable=True)
    last_job_count = Column(Integer, nullable=True)
    alert_sent_at = Column(DateTime(timezone=True), nullable=True)
