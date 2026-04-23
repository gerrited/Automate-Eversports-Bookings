"""
Booking worker — runs as a Kubernetes CronJob every 15 minutes.
Checks all enabled jobs and executes due bookings via Eversports API.
"""
from __future__ import annotations

import logging
import sys
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.db import SessionLocal
from backend.models.booking_job import BookingJob
from backend.models.booking_log import BookingLog
from backend.models.user import User
from backend.core.encryption import decrypt
from backend.core.booking import book_session, cancel_booking
from worker.email import send_booking_failure_email, send_admin_booking_failure_email, send_debug_cancel_failure_email

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger(__name__)

BERLIN = ZoneInfo("Europe/Berlin")
MAX_WORKERS = 10


def is_due(job: BookingJob, now: datetime) -> bool:
    """True if today + days_in_advance lands on job.weekday AND the current
    Berlin-local time falls within the same 15-minute slot as target_time."""
    target_date = now.date() + timedelta(days=job.days_in_advance)
    return (
        target_date.weekday() == job.weekday
        and now.hour == job.target_time.hour
        and (now.minute // 15) == (job.target_time.minute // 15)
    )


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


def process_job(job_id: str, now: datetime, session_factory, admin_emails: list[str]) -> None:
    """Processes a single booking job in its own DB session. Designed to run in a thread."""
    db = session_factory()
    try:
        job = db.query(BookingJob).filter(BookingJob.id == job_id).first()
        if job is None:
            log.error("Job %s: not found", job_id)
            return

        target_date = now.date() + timedelta(days=job.days_in_advance)
        log.info("Job %s: due for %s", job.id, target_date)

        if already_booked(db, job, target_date):
            log.info("Job %s: already booked for %s, skipping", job.id, target_date)
            return

        user = db.query(User).filter(User.id == job.user_id).first()
        if user is None:
            log.error("Job %s: user %s not found", job.id, job.user_id)
            return

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
            try:
                send_booking_failure_email(user.email, job, str(exc), target_date)
            except Exception as email_exc:
                log.error("Job %s: could not send failure email — %s", job.id, email_exc)
            if admin_emails:
                try:
                    send_admin_booking_failure_email(admin_emails, user.email, job, str(exc), target_date)
                except Exception as email_exc:
                    log.error("Job %s: could not send admin failure email — %s", job.id, email_exc)

        if job.debug and log_entry.status == "success":
            try:
                cancel_booking(
                    email=user.email,
                    password=password,
                    class_name=job.class_name,
                    facility_id=job.facility_id,
                )
                log_entry.message = f"[DEBUG] booked and cancelled"
                log.info("Job %s: debug booking cancelled", job.id)
            except Exception as cancel_exc:
                log_entry.message = f"[DEBUG] booked but cancel failed: {cancel_exc}"
                log.error("Job %s: debug cancel failed — %s", job.id, cancel_exc)
                try:
                    send_debug_cancel_failure_email(user.email, job, str(cancel_exc), target_date)
                except Exception as email_exc:
                    log.error("Job %s: could not send debug cancel failure email — %s", job.id, email_exc)

        db.add(log_entry)
        db.commit()

        if job.one_time and log_entry.status in ("success", "already_booked"):
            log.info("Job %s: one-time job executed successfully, deleting", job.id)
            db.delete(job)
            db.commit()
    finally:
        db.close()


def run(now: datetime, session_factory=None) -> None:
    if session_factory is None:
        session_factory = SessionLocal

    db = session_factory()
    try:
        jobs = (
            db.query(BookingJob)
            .join(User, BookingJob.user_id == User.id)
            .filter(BookingJob.enabled.is_(True), User.active.is_(True))
            .all()
        )
        due_job_ids = [j.id for j in jobs if is_due(j, now)]
        admin_emails = [
            u.email for u in db.query(User).filter(User.role == "admin", User.active.is_(True)).all()
        ]
        log.info("Found %d active jobs, %d due, %d admins", len(jobs), len(due_job_ids), len(admin_emails))
    finally:
        db.close()

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(process_job, jid, now, session_factory, admin_emails): jid for jid in due_job_ids}
        for future in as_completed(futures):
            try:
                future.result()
            except Exception as exc:
                log.error("Job %s: unhandled thread error — %s", futures[future], exc)


def main() -> None:
    run(datetime.now(BERLIN))


if __name__ == "__main__":
    main()
