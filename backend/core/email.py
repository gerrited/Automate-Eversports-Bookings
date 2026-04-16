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

        now = datetime.now(BERLIN).strftime("%d.%m.%Y %H:%M")
        subject = f"Neuer User: {new_user_email}"
        html = f"""
<p>Ein neuer User hat sich registriert und wartet auf Freigabe.</p>
<ul>
  <li><strong>Email:</strong> {new_user_email}</li>
  <li><strong>Registriert am:</strong> {now} Uhr</li>
</ul>
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
