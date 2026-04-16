"""
Email notifications for the backend via Resend.
"""
from __future__ import annotations

import logging
import os
from datetime import datetime
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

        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")
        users_url = f"{frontend_url}/#users"

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
            "from": from_email,
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

        if is_active:
            subject = "Dein Konto wurde freigeschaltet"
            html = "<p>Dein Konto für FOReversports wurde freigeschaltet. Du kannst dich ab sofort anmelden.</p>"
        else:
            subject = "Dein Konto wurde deaktiviert"
            html = "<p>Dein Konto für FOReversports wurde deaktiviert. Wende dich an einen Admin, falls du Fragen hast.</p>"

        resend.Emails.send({
            "from": from_email,
            "to": [user_email],
            "subject": subject,
            "html": html,
        })
        status_str = "activated" if is_active else "deactivated"
        log.info("Account status email (%s) sent to %s", status_str, user_email)
    except Exception as exc:
        log.error("Failed to send account status email to %s: %s", user_email, exc)
