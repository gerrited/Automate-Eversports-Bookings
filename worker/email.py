"""
Email notifications for booking failures via Resend.
"""
from __future__ import annotations

import logging
import os
from datetime import date
from pathlib import Path

import resend
from jinja2 import Environment, FileSystemLoader

from backend.core.constants import WEEKDAYS_DE

log = logging.getLogger(__name__)

_templates = Environment(
    loader=FileSystemLoader([
        Path(__file__).parent / "templates" / "email",
        Path(__file__).parent.parent / "backend" / "templates" / "email",
    ]),
    autoescape=True,
)


def _send(to: list[str], subject: str, html: str) -> None:
    resend.api_key = os.environ["RESEND_API_KEY"]
    from_email = os.environ["FROM_EMAIL"]
    resend.Emails.send({
        "from": f"FOReversports <{from_email}>",
        "to": to,
        "subject": subject,
        "html": html,
    })


def send_booking_failure_email(user_email: str, job, error_message: str, target_date: date) -> None:
    """Sendet eine Failure-Email via Resend. Best-effort — kein Crash bei Fehlern."""
    try:
        time_str = job.target_time.strftime("%H:%M")
        date_str = target_date.strftime("%d.%m.%Y")
        weekday_str = WEEKDAYS_DE[target_date.weekday()]
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")

        subject = f"Buchung fehlgeschlagen: {job.class_name} am {date_str}"
        html = _templates.get_template("booking_failure.html").render(
            class_name=job.class_name,
            time_str=time_str,
            weekday_str=weekday_str,
            date_str=date_str,
            facility_name=job.facility_name,
            error_message=error_message,
            frontend_url=frontend_url,
        )
        _send([user_email], subject, html)
        log.info("Failure email sent to %s for job %s", user_email, job.id)
    except Exception as exc:
        log.error("Failed to send failure email to %s: %s", user_email, exc)


def send_admin_booking_failure_email(
    admin_emails: list[str],
    user_email: str,
    job,
    error_message: str,
    target_date: date,
) -> None:
    """Benachrichtigt alle aktiven Admins über eine fehlgeschlagene Buchung. Best-effort."""
    if not admin_emails:
        return
    try:
        time_str = job.target_time.strftime("%H:%M")
        date_str = target_date.strftime("%d.%m.%Y")
        weekday_str = WEEKDAYS_DE[target_date.weekday()]
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")

        subject = f"[Admin] Buchung fehlgeschlagen: {user_email} — {job.class_name} am {date_str}"
        html = _templates.get_template("admin_booking_failure.html").render(
            class_name=job.class_name,
            time_str=time_str,
            weekday_str=weekday_str,
            date_str=date_str,
            facility_name=job.facility_name,
            error_message=error_message,
            frontend_url=frontend_url,
            user_email=user_email,
            job_id=job.id,
        )
        _send(admin_emails, subject, html)
        log.info("Admin failure email sent for job %s (user %s)", job.id, user_email)
    except Exception as exc:
        log.error("Failed to send admin failure email for job %s: %s", job.id, exc)


def send_debug_cancel_failure_email(user_email: str, job, error_message: str, target_date: date) -> None:
    """Sendet eine Email wenn die Stornierung einer Debug-Buchung fehlgeschlagen ist."""
    try:
        time_str = job.target_time.strftime("%H:%M")
        date_str = target_date.strftime("%d.%m.%Y")
        weekday_str = WEEKDAYS_DE[target_date.weekday()]
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")

        subject = f"Debug-Stornierung fehlgeschlagen: {job.class_name} am {date_str}"
        html = _templates.get_template("debug_cancel_failure.html").render(
            class_name=job.class_name,
            time_str=time_str,
            weekday_str=weekday_str,
            date_str=date_str,
            facility_name=job.facility_name,
            error_message=error_message,
            frontend_url=frontend_url,
        )
        _send([user_email], subject, html)
        log.info("Debug cancel failure email sent to %s for job %s", user_email, job.id)
    except Exception as exc:
        log.error("Failed to send debug cancel failure email to %s: %s", user_email, exc)


def send_waitlist_notification(user_email: str, job, target_date: date) -> None:
    """Benachrichtigt den Nutzer über die erfolgreiche Wartelisten-Anmeldung. Best-effort."""
    try:
        time_str = job.target_time.strftime("%H:%M")
        date_str = target_date.strftime("%d.%m.%Y")
        weekday_str = WEEKDAYS_DE[target_date.weekday()]
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")

        subject = f"Warteliste: {job.class_name} am {date_str}"
        html = _templates.get_template("booking_waitlist.html").render(
            class_name=job.class_name,
            time_str=time_str,
            weekday_str=weekday_str,
            date_str=date_str,
            facility_name=job.facility_name,
            frontend_url=frontend_url,
        )
        _send([user_email], subject, html)
        log.info("Waitlist notification sent to %s for job %s", user_email, job.id)
    except Exception as exc:
        log.error("Failed to send waitlist notification to %s: %s", user_email, exc)
