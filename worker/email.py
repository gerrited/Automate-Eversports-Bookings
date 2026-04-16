"""
Email notifications for booking failures via Resend.
"""
from __future__ import annotations

import logging
import os
from datetime import date

import resend

log = logging.getLogger(__name__)

WEEKDAYS_DE = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag"]


def send_booking_failure_email(user_email: str, job, error_message: str, target_date: date) -> None:
    """Sendet eine Failure-Email via Resend. Best-effort — kein Crash bei Fehlern."""
    try:
        resend.api_key = os.environ["RESEND_API_KEY"]
        from_email = os.environ["FROM_EMAIL"]

        time_str = job.target_time.strftime("%H:%M")
        date_str = target_date.strftime("%d.%m.%Y")
        weekday_str = WEEKDAYS_DE[target_date.weekday()]

        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")

        subject = f"Buchung fehlgeschlagen: {job.class_name} am {date_str}"
        html = f"""
<p><strong>Deine Buchung für {job.class_name} ist fehlgeschlagen.</strong></p>
<ul>
  <li><strong>Kurs:</strong> {job.class_name} — {time_str} Uhr</li>
  <li><strong>Tag:</strong> {weekday_str}, {date_str}</li>
  <li><strong>Facility:</strong> {job.facility_name}</li>
</ul>
<p><strong>Fehler:</strong> <code>{error_message}</code></p>
<p>Der Job ist weiterhin aktiv und wird beim nächsten Versuch erneut ausgeführt.</p>
<p><a href="{frontend_url}">Zur App</a></p>
"""

        resend.Emails.send({
            "from": from_email,
            "to": [user_email],
            "subject": subject,
            "html": html,
        })
        log.info("Failure email sent to %s for job %s", user_email, job.id)
    except Exception as exc:
        log.error("Failed to send failure email to %s: %s", user_email, exc)
