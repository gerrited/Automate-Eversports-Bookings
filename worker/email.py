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

log = logging.getLogger(__name__)

WEEKDAYS_DE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]

_templates = Environment(
    loader=FileSystemLoader(Path(__file__).parent / "templates" / "email"),
    autoescape=True,
)


def send_booking_failure_email(user_email: str, job, error_message: str, target_date: date) -> None:
    """Sendet eine Failure-Email via Resend. Best-effort — kein Crash bei Fehlern."""
    try:
        resend.api_key = os.environ["RESEND_API_KEY"]
        from_email = os.environ["FROM_EMAIL"]

        time_str = job.target_time.strftime("%H:%M")
        date_str = target_date.strftime("%d.%m.%Y")
        weekday_str = WEEKDAYS_DE[target_date.weekday()]

        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
        sender = f"FOReversports <{from_email}>"

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

        resend.Emails.send({
            "from": sender,
            "to": [user_email],
            "subject": subject,
            "html": html,
        })
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
        resend.api_key = os.environ["RESEND_API_KEY"]
        from_email = os.environ["FROM_EMAIL"]

        time_str = job.target_time.strftime("%H:%M")
        date_str = target_date.strftime("%d.%m.%Y")
        weekday_str = WEEKDAYS_DE[target_date.weekday()]

        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
        sender = f"FOReversports <{from_email}>"

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

        resend.Emails.send({
            "from": sender,
            "to": admin_emails,
            "subject": subject,
            "html": html,
        })
        log.info("Admin failure email sent for job %s (user %s)", job.id, user_email)
    except Exception as exc:
        log.error("Failed to send admin failure email for job %s: %s", job.id, exc)


def send_debug_cancel_failure_email(user_email: str, job, error_message: str, target_date: date) -> None:
    """Sendet eine Email wenn die Stornierung einer Debug-Buchung fehlgeschlagen ist."""
    try:
        resend.api_key = os.environ["RESEND_API_KEY"]
        from_email = os.environ["FROM_EMAIL"]

        time_str = job.target_time.strftime("%H:%M")
        date_str = target_date.strftime("%d.%m.%Y")
        weekday_str = WEEKDAYS_DE[target_date.weekday()]

        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
        sender = f"FOReversports <{from_email}>"

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

        resend.Emails.send({
            "from": sender,
            "to": [user_email],
            "subject": subject,
            "html": html,
        })
        log.info("Debug cancel failure email sent to %s for job %s", user_email, job.id)
    except Exception as exc:
        log.error("Failed to send debug cancel failure email to %s: %s", user_email, exc)


def send_waitlist_notification(user_email: str, job, target_date: date) -> None:
    """Benachrichtigt den Nutzer über die erfolgreiche Wartelisten-Anmeldung. Best-effort."""
    try:
        resend.api_key = os.environ["RESEND_API_KEY"]
        from_email = os.environ["FROM_EMAIL"]

        time_str = job.target_time.strftime("%H:%M")
        date_str = target_date.strftime("%d.%m.%Y")
        weekday_str = WEEKDAYS_DE[target_date.weekday()]

        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
        sender = f"FOReversports <{from_email}>"

        subject = f"Warteliste: {job.class_name} am {date_str}"
        html = _templates.get_template("booking_waitlist.html").render(
            class_name=job.class_name,
            time_str=time_str,
            weekday_str=weekday_str,
            date_str=date_str,
            facility_name=job.facility_name,
            frontend_url=frontend_url,
        )

        resend.Emails.send({
            "from": sender,
            "to": [user_email],
            "subject": subject,
            "html": html,
        })
        log.info("Waitlist notification sent to %s for job %s", user_email, job.id)
    except Exception as exc:
        log.error("Failed to send waitlist notification to %s: %s", user_email, exc)
