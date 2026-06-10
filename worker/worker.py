"""
Booking worker — runs as a Kubernetes CronJob every 15 minutes.
Checks all enabled jobs and executes due bookings via Eversports API.
"""
from __future__ import annotations

import logging
import sys
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import or_
from sqlalchemy.orm import Session

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.db import SessionLocal
from backend.models.booking_job import BookingJob
from backend.models.booking_log import BookingLog
from backend.models.user import User
from backend.core.encryption import decrypt
from backend.core.status import BookingStatus
from backend.core.booking import book_session, cancel_booking, fetch_upcoming_bookings
from backend.core.schedule import compute_next_run
from worker.email import send_booking_failure_email, send_admin_booking_failure_email, send_debug_cancel_failure_email, send_waitlist_notification
from backend.models.push_subscription import PushSubscription
from worker.notifications import send_push_notifications

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    stream=sys.stdout,
)
log = logging.getLogger(__name__)

BERLIN = ZoneInfo("Europe/Berlin")
MAX_WORKERS = 10


def _normalize_now(now: datetime) -> datetime:
    """Naive Zeitangaben werden als Europe/Berlin interpretiert."""
    return now.replace(tzinfo=BERLIN) if now.tzinfo is None else now


def _as_utc(dt: datetime) -> datetime:
    """DB-Werte normalisieren: SQLite liefert naive Datetimes (gespeichert als UTC)."""
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt.astimezone(timezone.utc)


def already_booked(db: Session, job: BookingJob, target_date: date) -> bool:
    """True if a terminal log (success or waitlist) already exists for this job + date."""
    return (
        db.query(BookingLog)
        .filter(
            BookingLog.job_id == job.id,
            BookingLog.target_date == target_date,
            BookingLog.status.in_(["success", "waitlist"]),
        )
        .first()
        is not None
    )


def process_job(job_id: str, now: datetime, session_factory, admin_emails: list[str]) -> None:
    """Processes a single booking job in its own DB session. Designed to run in a thread."""
    now = _normalize_now(now)
    db = session_factory()
    try:
        # Claim per Row-Lock: parallele Worker überspringen gelockte Jobs
        # (SKIP LOCKED greift auf PostgreSQL; SQLite kennt kein FOR UPDATE)
        job = (
            db.query(BookingJob)
            .filter(BookingJob.id == job_id, BookingJob.enabled.is_(True))
            .with_for_update(skip_locked=True)
            .first()
        )
        if job is None:
            log.info("Job %s: nicht gefunden, deaktiviert oder von anderem Worker gelockt", job_id)
            return

        def advance() -> None:
            job.next_run_at = compute_next_run(job.weekday, job.target_time, job.days_in_advance, after=now)

        if job.next_run_at is None:
            # Bestandsdaten: einplanen, aber nicht rückwirkend ausführen
            advance()
            db.commit()
            log.info("Job %s: next_run_at initialisiert auf %s", job.id, job.next_run_at)
            return

        scheduled_at = _as_utc(job.next_run_at)
        if scheduled_at > now:
            return  # bereits von einem anderen Lauf weitergeschaltet

        # target_date leitet sich vom geplanten Lauf ab — bei Nachholläufen
        # bleibt so das ursprünglich gemeinte Kursdatum erhalten
        target_date = scheduled_at.astimezone(BERLIN).date() + timedelta(days=job.days_in_advance)
        log.info("Job %s: due for %s (geplant %s)", job.id, target_date, scheduled_at)

        class_start = datetime.combine(target_date, job.target_time, tzinfo=BERLIN)
        if class_start <= now:
            log.warning("Job %s: Lauf verpasst, Kurs am %s liegt in der Vergangenheit", job.id, target_date)
            db.add(BookingLog(
                job_id=job.id,
                target_date=target_date,
                status=BookingStatus.FAILED,
                message="Lauf verpasst: Der Worker war zum geplanten Zeitpunkt nicht aktiv und der Termin liegt bereits in der Vergangenheit.",
            ))
            advance()
            db.commit()
            return

        if already_booked(db, job, target_date):
            log.info("Job %s: already booked for %s, skipping", job.id, target_date)
            advance()
            db.commit()
            return

        user = db.query(User).filter(User.id == job.user_id).first()
        if user is None:
            log.error("Job %s: user %s not found", job.id, job.user_id)
            return

        try:
            password = decrypt(user.encrypted_password, aad=user.eversports_user_id)
            result = book_session(
                email=user.email,
                password=password,
                target_date=target_date,
                target_time=job.target_time.strftime("%H:%M"),
                facility_id=job.facility_id,
                class_name=job.class_name,
                event_type=job.event_type,
            )
            log_entry = BookingLog(
                job_id=job.id,
                target_date=target_date,
                status=result["status"],
                message=result.get("order_id"),
            )
            log.info("Job %s: %s order=%s event_type=%s", job.id, result["status"], result.get("order_id"), result.get("event_type"))
            if result["status"] == BookingStatus.SUCCESS and result.get("event_type") and job.event_type != result["event_type"]:
                job.event_type = result["event_type"]
                db.add(job)
            if result["status"] == BookingStatus.WAITLIST:
                try:
                    send_waitlist_notification(user.email, job, target_date)
                except Exception as email_exc:
                    log.error("Job %s: could not send waitlist notification — %s", job.id, email_exc)
        except Exception as exc:
            log_entry = BookingLog(
                job_id=job.id,
                target_date=target_date,
                status=BookingStatus.FAILED,
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

        if job.debug and log_entry.status == BookingStatus.SUCCESS:
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
        if log_entry.status in ("success", "already_booked", "waitlist"):
            user.total_bookings_executed += 1
        advance()
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

    now = _normalize_now(now)
    now_utc = now.astimezone(timezone.utc)
    db = session_factory()
    try:
        due_job_ids = [
            row.id
            for row in db.query(BookingJob.id)
            .join(User, BookingJob.user_id == User.id)
            .filter(
                BookingJob.enabled.is_(True),
                User.active.is_(True),
                or_(BookingJob.next_run_at.is_(None), BookingJob.next_run_at <= now_utc),
            )
            .all()
        ]
        admin_emails = [
            u.email for u in db.query(User).filter(User.role == "admin", User.active.is_(True)).all()
        ]
        log.info("Found %d due jobs, %d admins", len(due_job_ids), len(admin_emails))
    finally:
        db.close()

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(process_job, jid, now, session_factory, admin_emails): jid for jid in due_job_ids}
        for future in as_completed(futures):
            try:
                future.result()
            except Exception as exc:
                log.error("Job %s: unhandled thread error — %s", futures[future], exc)

    _run_push_notifications(now, session_factory)


def _run_push_notifications(now: datetime, session_factory) -> None:
    db = session_factory()
    try:
        users_with_subs = (
            db.query(User)
            .join(PushSubscription, PushSubscription.user_id == User.id)
            .filter(User.active.is_(True))
            .distinct()
            .all()
        )
        log.info("Push notifications: checking %d users with subscriptions", len(users_with_subs))
        for user in users_with_subs:
            try:
                password = decrypt(user.encrypted_password, aad=user.eversports_user_id)
                bookings = fetch_upcoming_bookings(user.email, password)
                send_push_notifications(db, user, bookings, now)
            except Exception as exc:
                log.error("Push notification error for user %s: %s", user.email, exc)
    finally:
        db.close()


def main() -> None:
    run(datetime.now(BERLIN))


if __name__ == "__main__":
    main()
