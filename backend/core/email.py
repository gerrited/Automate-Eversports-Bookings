"""
Email notifications for the backend via Resend.
"""
from __future__ import annotations

import logging
import os
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import resend

log = logging.getLogger(__name__)

BERLIN = ZoneInfo("Europe/Berlin")


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
        html = f"""
<p>Ein neuer User hat sich registriert und wartet auf Freigabe.</p>
<ul>
  <li><strong>Email:</strong> {new_user_email}</li>
  <li><strong>Registriert am:</strong> {now} Uhr</li>
</ul>
<p><a href="{users_url}">Zur Benutzerverwaltung</a></p>
"""
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
            html = f'<p>Dein Konto für FOReversports wurde freigeschaltet. Du kannst dich ab sofort <a href="{frontend_url}">anmelden</a>.</p>'
        else:
            subject = "Dein Konto wurde deaktiviert"
            html = "<p>Dein Konto für FOReversports wurde deaktiviert. Wende dich an einen Admin, falls du Fragen hast.</p>"

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
        html = f"""
<p>Ein neuer User hat sich registriert und wartet auf Freigabe.</p>
<ul>
  <li><strong>Email:</strong> test@example.com</li>
  <li><strong>Registriert am:</strong> {now} Uhr</li>
</ul>
<p><a href="{users_url}">Zur Benutzerverwaltung</a></p>
"""
    elif email_type == "account_activated":
        subject = "Dein Konto wurde freigeschaltet"
        html = f'<p>Dein Konto für FOReversports wurde freigeschaltet. Du kannst dich ab sofort <a href="{frontend_url}">anmelden</a>.</p>'
    elif email_type == "account_deactivated":
        subject = "Dein Konto wurde deaktiviert"
        html = "<p>Dein Konto für FOReversports wurde deaktiviert. Wende dich an einen Admin, falls du Fragen hast.</p>"
    elif email_type == "booking_failure":
        dummy_date = _next_friday()
        date_str = dummy_date.strftime("%d.%m.%Y")
        weekday_str = _WEEKDAYS_DE[dummy_date.weekday()]
        subject = f"Buchung fehlgeschlagen: Yoga Basics am {date_str}"
        html = f"""
<p><strong>Deine Buchung für Yoga Basics ist fehlgeschlagen.</strong></p>
<ul>
  <li><strong>Kurs:</strong> Yoga Basics — 18:00 Uhr</li>
  <li><strong>Tag:</strong> {weekday_str}, {date_str}</li>
  <li><strong>Facility:</strong> FitnessPark Mitte</li>
</ul>
<p><strong>Fehler:</strong> <code>Kurs bereits ausgebucht</code></p>
<p>Der Job ist weiterhin aktiv und wird beim nächsten Versuch erneut ausgeführt.</p>
<p><a href="{frontend_url}">Zur App</a></p>
"""
    elif email_type == "debug_cancel_failure":
        dummy_date = _next_friday()
        date_str = dummy_date.strftime("%d.%m.%Y")
        weekday_str = _WEEKDAYS_DE[dummy_date.weekday()]
        subject = f"Debug-Stornierung fehlgeschlagen: Yoga Basics am {date_str}"
        html = f"""
<p><strong>Die Debug-Buchung für Yoga Basics wurde erfolgreich gebucht, konnte aber nicht automatisch storniert werden.</strong></p>
<ul>
  <li><strong>Kurs:</strong> Yoga Basics — 18:00 Uhr</li>
  <li><strong>Tag:</strong> {weekday_str}, {date_str}</li>
  <li><strong>Facility:</strong> FitnessPark Mitte</li>
</ul>
<p><strong>Fehler:</strong> <code>Verbindung fehlgeschlagen</code></p>
<p>Bitte storniere die Buchung manuell auf Eversports.</p>
<p><a href="{frontend_url}">Zur App</a></p>
"""
    else:
        raise ValueError(f"Unknown email type: {email_type}")

    resend.Emails.send({
        "from": sender,
        "to": [admin_email],
        "subject": subject,
        "html": html,
    })
    log.info("Test email (%s) sent to %s", email_type, admin_email)
