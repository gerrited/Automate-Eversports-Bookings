# Design: Admin-Benachrichtigung bei fehlgeschlagenen Buchungen

**Datum:** 2026-04-23

## Überblick

Wenn eine Buchung im Worker fehlschlägt, sollen zusätzlich zum Buchungsinhaber alle aktiven Admins per E-Mail benachrichtigt werden. Die Admin-E-Mail enthält dieselben Job-Details wie die User-E-Mail, plus die E-Mail-Adresse des betroffenen Nutzers.

Debug-Cancel-Fehler sind von dieser Benachrichtigung ausgeschlossen.

## Neue Templates

**`worker/templates/email/admin_booking_failure.html`**
- Basiert auf `booking_failure.html`
- Zusätzliche Variablen: `user_email`, `job_id`
- Zeigt am Anfang einen Block: „Buchung für [user_email] (Job [job_id]) fehlgeschlagen"

## Neue Email-Funktion

In `worker/email.py`:

```python
def send_admin_booking_failure_email(
    admin_emails: list[str],
    user_email: str,
    job,
    error_message: str,
    target_date: date,
) -> None:
```

- Schickt eine einzelne Resend-Anfrage an alle `admin_emails`
- Verwendet das neue Template `admin_booking_failure.html`
- Gleiche Best-effort-Fehlerbehandlung wie bestehende Funktionen (kein Crash)
- Keine Aktion wenn `admin_emails` leer ist

## Änderungen im Worker

In `worker/worker.py`, Funktion `run()`:

1. Einmalig am Anfang: alle aktiven Admins laden
   ```python
   admin_emails = [u.email for u in db.query(User).filter(User.role == "admin", User.active.is_(True)).all()]
   ```

2. Im Fehler-Handler (nach `send_booking_failure_email`): zusätzlich aufrufen
   ```python
   send_admin_booking_failure_email(admin_emails, user.email, job, str(exc), target_date)
   ```

## Nicht im Scope

- Admin-Benachrichtigung bei Debug-Cancel-Fehlern
- Deduplication (Admins die selbst den Job besitzen erhalten beide E-Mails — diese haben unterschiedliche Inhalte und das ist gewollt)
