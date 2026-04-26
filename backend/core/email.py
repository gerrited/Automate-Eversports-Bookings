"""
Email notifications for the backend via Resend.
"""
from __future__ import annotations

import logging
import os
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import resend
from jinja2 import Environment, FileSystemLoader

log = logging.getLogger(__name__)

BERLIN = ZoneInfo("Europe/Berlin")

_templates = Environment(
    loader=FileSystemLoader(Path(__file__).parent.parent / "templates" / "email"),
    autoescape=True,
)


def send_new_user_notification(admin_emails: list[str], new_user_email: str) -> None:
    """Benachrichtigt alle Admins über einen neuen User. Best-effort — kein Crash bei Fehlern."""
    if not admin_emails:
        return
    try:
        resend.api_key = os.environ["RESEND_API_KEY"]
        from_email = os.environ["FROM_EMAIL"]
        sender = f"FOReversports <{from_email}>"

        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
        users_url = f"{frontend_url}/dashboard#users"
        now = datetime.now(BERLIN).strftime("%d.%m.%Y %H:%M")

        subject = f"Neuer User: {new_user_email}"
        html = _templates.get_template("new_user_notification.html").render(
            new_user_email=new_user_email,
            now=now,
            users_url=users_url,
            frontend_url=frontend_url,
        )
        resend.Emails.send({
            "from": sender,
            "to": admin_emails,
            "subject": subject,
            "html": html,
        })
        log.info("New user notification sent to %d admin(s) for %s", len(admin_emails), new_user_email)
    except Exception as exc:
        log.error("Failed to send new user notification: %s", exc)


def send_account_status_email(user_email: str, is_active: bool) -> None:
    """Benachrichtigt den User über eine Konto-Statusänderung. Best-effort — kein Crash bei Fehlern."""
    try:
        resend.api_key = os.environ["RESEND_API_KEY"]
        from_email = os.environ["FROM_EMAIL"]
        sender = f"FOReversports <{from_email}>"
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")

        if is_active:
            subject = "Dein Konto wurde freigeschaltet"
            html = _templates.get_template("account_activated.html").render(frontend_url=frontend_url)
        else:
            subject = "Dein Konto wurde deaktiviert"
            html = _templates.get_template("account_deactivated.html").render(frontend_url=frontend_url)

        resend.Emails.send({
            "from": sender,
            "to": [user_email],
            "subject": subject,
            "html": html,
        })
        status_str = "activated" if is_active else "deactivated"
        log.info("Account status email (%s) sent to %s", status_str, user_email)
    except Exception as exc:
        log.error("Failed to send account status email to %s: %s", user_email, exc)


def send_limit_enforced_email(user_email: str, max_active_jobs: int) -> None:
    """Benachrichtigt den User, dass sein Limit gesetzt und alle Jobs deaktiviert wurden. Best-effort."""
    try:
        resend.api_key = os.environ["RESEND_API_KEY"]
        from_email = os.environ["FROM_EMAIL"]
        sender = f"FOReversports <{from_email}>"
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")

        subject = "Dein Buchungslimit wurde angepasst"
        html = _templates.get_template("limit_enforced.html").render(
            max_active_jobs=max_active_jobs,
            frontend_url=frontend_url,
        )
        resend.Emails.send({
            "from": sender,
            "to": [user_email],
            "subject": subject,
            "html": html,
        })
        log.info("Limit enforced email sent to %s (limit=%d)", user_email, max_active_jobs)
    except Exception as exc:
        log.error("Failed to send limit enforced email to %s: %s", user_email, exc)


_WEEKDAYS_DE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]


def _next_friday() -> date:
    today = date.today()
    days_ahead = (4 - today.weekday()) % 7 or 7
    return today + timedelta(days=days_ahead)


def send_test_email(admin_email: str, email_type: str) -> None:
    """Sendet eine Test-Mail an den Admin. Wirft bei Fehlern (kein best-effort)."""
    resend.api_key = os.environ["RESEND_API_KEY"]
    from_email = os.environ["FROM_EMAIL"]
    sender = f"FOReversports <{from_email}>"
    frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")

    if email_type == "new_user":
        now = datetime.now(BERLIN).strftime("%d.%m.%Y %H:%M")
        users_url = f"{frontend_url}/dashboard#users"
        subject = "Neuer User: test@example.com"
        html = _templates.get_template("new_user_notification.html").render(
            new_user_email="test@example.com",
            now=now,
            users_url=users_url,
            frontend_url=frontend_url,
        )
    elif email_type == "account_activated":
        subject = "Dein Konto wurde freigeschaltet"
        html = _templates.get_template("account_activated.html").render(frontend_url=frontend_url)
    elif email_type == "account_deactivated":
        subject = "Dein Konto wurde deaktiviert"
        html = _templates.get_template("account_deactivated.html").render(frontend_url=frontend_url)
    elif email_type == "booking_failure":
        dummy_date = _next_friday()
        date_str = dummy_date.strftime("%d.%m.%Y")
        weekday_str = _WEEKDAYS_DE[dummy_date.weekday()]
        subject = f"Buchung fehlgeschlagen: Yoga Basics am {date_str}"
        html = _templates.get_template("booking_failure.html").render(
            class_name="Yoga Basics",
            time_str="18:00",
            weekday_str=weekday_str,
            date_str=date_str,
            facility_name="FitnessPark Mitte",
            error_message="Kurs bereits ausgebucht",
            frontend_url=frontend_url,
        )
    elif email_type == "debug_cancel_failure":
        dummy_date = _next_friday()
        date_str = dummy_date.strftime("%d.%m.%Y")
        weekday_str = _WEEKDAYS_DE[dummy_date.weekday()]
        subject = f"Debug-Stornierung fehlgeschlagen: Yoga Basics am {date_str}"
        html = _templates.get_template("debug_cancel_failure.html").render(
            class_name="Yoga Basics",
            time_str="18:00",
            weekday_str=weekday_str,
            date_str=date_str,
            facility_name="FitnessPark Mitte",
            error_message="Verbindung fehlgeschlagen",
            frontend_url=frontend_url,
        )
    else:
        raise ValueError(f"Unknown email type: {email_type}")

    resend.Emails.send({
        "from": sender,
        "to": [admin_email],
        "subject": subject,
        "html": html,
    })
    log.info("Test email (%s) sent to %s", email_type, admin_email)


def send_admin_message(user_email: str, subject: str, content: str) -> None:
    """Sendet eine Admin-Nachricht an einen User. Best-effort — kein Crash bei Fehlern."""
    try:
        resend.api_key = os.environ["RESEND_API_KEY"]
        from_email = os.environ["FROM_EMAIL"]
        sender = f"FOReversports <{from_email}>"
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")

        html = _templates.get_template("admin_message.html").render(
            subject=subject,
            content=content,
            frontend_url=frontend_url,
        )
        resend.Emails.send({
            "from": sender,
            "to": [user_email],
            "subject": subject,
            "html": html,
        })
        log.info("Admin message sent to %s (subject=%r)", user_email, subject)
    except Exception as exc:
        log.error("Failed to send admin message to %s: %s", user_email, exc)
