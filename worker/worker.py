"""
Hourly booking worker — runs as a Kubernetes CronJob.
Checks all enabled jobs and executes due bookings via Eversports API.
"""
from __future__ import annotations

import logging
import sys
import os
from datetime import date, timedelta

from sqlalchemy.orm import Session

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.db import SessionLocal
from backend.models.booking_job import BookingJob
from backend.models.booking_log import BookingLog
from backend.models.user import User
from backend.core.encryption import decrypt
from backend.core.booking import book_session

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger(__name__)


def is_due(job: BookingJob, today: date) -> bool:
    """True if today + days_in_advance lands on job.weekday."""
    target_date = today + timedelta(days=job.days_in_advance)
    return target_date.weekday() == job.weekday


def already_booked(db: Session, job: BookingJob, target_date: date) -> bool:
    """True if a success log already exists for this job + date."""
    return (
        db.query(BookingLog)
        .filter(
            BookingLog.job_id == job.id,
            BookingLog.target_date == target_date,
            BookingLog.status == "success",
        )
        .first()
        is not None
    )


def run(db: Session, today: date) -> None:
    jobs = db.query(BookingJob).filter(BookingJob.enabled.is_(True)).all()
    log.info("Found %d active jobs", len(jobs))

    for job in jobs:
        if not is_due(job, today):
            continue

        target_date = today + timedelta(days=job.days_in_advance)
        log.info("Job %s: due for %s", job.id, target_date)

        if already_booked(db, job, target_date):
            log.info("Job %s: already booked for %s, skipping", job.id, target_date)
            continue

        user = db.query(User).filter(User.id == job.user_id).first()
        if user is None:
            log.error("Job %s: user %s not found", job.id, job.user_id)
            continue

        try:
            password = decrypt(user.encrypted_password)
            result = book_session(
                email=user.email,
                password=password,
                target_date=target_date,
                target_time=job.target_time.strftime("%H:%M"),
                facility_id=job.facility_id,
                class_name=job.class_name,
            )
            log_entry = BookingLog(
                job_id=job.id,
                target_date=target_date,
                status=result["status"],
                message=result.get("order_id"),
            )
            log.info("Job %s: %s order=%s", job.id, result["status"], result.get("order_id"))
        except Exception as exc:
            log_entry = BookingLog(
                job_id=job.id,
                target_date=target_date,
                status="failed",
                message=str(exc),
            )
            log.error("Job %s: failed — %s", job.id, exc)

        db.add(log_entry)
        db.commit()


def main() -> None:
    db = SessionLocal()
    try:
        run(db, date.today())
    finally:
        db.close()


if __name__ == "__main__":
    main()
