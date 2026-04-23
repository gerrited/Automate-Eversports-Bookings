# Admin-Benachrichtigung bei fehlgeschlagenen Buchungen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alle aktiven Admins per E-Mail benachrichtigen wenn eine Buchung fehlschlägt — mit einem eigenen Template das Nutzer-E-Mail und Job-Details enthält.

**Architecture:** Neue Email-Funktion `send_admin_booking_failure_email` in `worker/email.py` mit eigenem HTML-Template. Der Worker lädt einmalig alle aktiven Admin-E-Mails am Anfang von `run()` und ruft die neue Funktion bei jedem Buchungsfehler auf.

**Tech Stack:** Python, Jinja2, Resend API, SQLAlchemy, pytest

> **Hinweis:** Die bestehenden Tests in `tests/worker/test_worker.py` importieren `process_job` und `MAX_WORKERS`, die in `worker/worker.py` nicht existieren — alle Worker-Tests sind aktuell kaputt. Dieser Plan fügt neue Tests für das neue Feature hinzu, die mit der aktuellen Worker-Struktur funktionieren.

---

## File Map

| Aktion | Datei | Verantwortung |
|--------|-------|---------------|
| Erstellen | `worker/templates/email/admin_booking_failure.html` | Admin-Email-Template mit Nutzer-Info |
| Modifizieren | `worker/email.py` | Neue Funktion `send_admin_booking_failure_email` |
| Modifizieren | `worker/worker.py` | Admin-Emails laden, neue Funktion aufrufen |
| Modifizieren | `tests/worker/test_worker.py` | Neue Tests für Admin-Benachrichtigung |

---

## Task 1: Admin-Email-Template erstellen

**Files:**
- Create: `worker/templates/email/admin_booking_failure.html`

- [ ] **Schritt 1: Template anlegen**

Datei `worker/templates/email/admin_booking_failure.html` mit folgendem Inhalt erstellen:

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Buchung fehlgeschlagen</title>
</head>
<body style="background:#021214;margin:0;padding:32px 16px;font-family:-apple-system,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;">

    <div style="background:#03191b;border-radius:12px 12px 0 0;padding:18px 24px;border:1px solid rgba(100,116,139,0.2);border-bottom:1px solid rgba(100,116,139,0.15);">
      <img src="{{ frontend_url }}/logo.png" alt="FOReversports" height="36"
           style="display:inline-block;vertical-align:middle;"
           onerror="this.style.display='none';this.nextElementSibling.style.display='inline-block'">
      <span style="display:none;font-size:18px;font-weight:700;vertical-align:middle;letter-spacing:-0.3px;">
        <span style="color:#26b5c0;">∞ FOR</span><span style="color:#9ca3af;font-weight:400;">eversports</span>
      </span>
    </div>

    <div style="background:#03191b;border-radius:0 0 12px 12px;border:1px solid rgba(100,116,139,0.2);border-top:none;padding:24px;">
      <p style="color:#f1f5f9;font-size:18px;font-weight:600;margin:0 0 12px;">Buchung fehlgeschlagen</p>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 16px;">Eine automatische Buchung konnte nicht durchgeführt werden.</p>
      <div style="background:#021214;border-radius:6px;padding:12px 16px;margin:0 0 16px;font-size:13px;color:#94a3b8;line-height:2;">
        <strong style="color:#cbd5e1;">Nutzer</strong>&nbsp;&nbsp;{{ user_email }}<br>
        <strong style="color:#cbd5e1;">Job&nbsp;&nbsp;&nbsp;</strong>&nbsp;{{ job_id }}<br>
        <strong style="color:#cbd5e1;">Kurs</strong>&nbsp;&nbsp;{{ class_name }} — {{ time_str }} Uhr<br>
        <strong style="color:#cbd5e1;">Tag&nbsp;&nbsp;</strong>&nbsp;{{ weekday_str }}, {{ date_str }}<br>
        <strong style="color:#cbd5e1;">Ort&nbsp;&nbsp;</strong>&nbsp;{{ facility_name }}
      </div>
      <div style="background:#1a0a0a;border-left:3px solid #f87171;border-radius:0 5px 5px 0;padding:10px 14px;margin:0 0 16px;font-size:13px;color:#f87171;font-family:monospace;">{{ error_message }}</div>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 20px;">Der Job ist weiterhin aktiv und wird beim nächsten Versuch erneut ausgeführt.</p>
      <a href="{{ frontend_url }}" style="display:inline-block;background:#004349;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 22px;border-radius:8px;">Zur App →</a>
    </div>

    <p style="color:#374151;font-size:11px;text-align:center;margin:16px 0 0;">FOReversports · Automatische Buchungsbenachrichtigung (Admin)</p>
  </div>
</body>
</html>
```

- [ ] **Schritt 2: Commit**

```bash
git add worker/templates/email/admin_booking_failure.html
git commit -m "feat: add admin booking failure email template"
```

---

## Task 2: `send_admin_booking_failure_email` Funktion schreiben

**Files:**
- Modify: `worker/email.py`
- Test: `tests/worker/test_worker.py`

- [ ] **Schritt 1: Failing test schreiben**

In `tests/worker/test_worker.py` oben in den Imports ergänzen:

```python
from worker.email import send_admin_booking_failure_email
```

Dann am Ende der Datei hinzufügen:

```python
# --- send_admin_booking_failure_email ---

def test_send_admin_booking_failure_email_calls_resend(mocker):
    mock_send = mocker.patch("resend.Emails.send")
    mocker.patch.dict("os.environ", {
        "RESEND_API_KEY": "test-key",
        "FROM_EMAIL": "from@test.com",
        "FRONTEND_URL": "http://localhost:5173",
    })

    job = BookingJob(
        id="j-admin-1",
        class_name="Yoga",
        target_time=time(10, 0),
        facility_name="FitnessCentre",
        facility_id="1",
        weekday=0,
        days_in_advance=1,
    )
    send_admin_booking_failure_email(
        admin_emails=["admin1@test.com", "admin2@test.com"],
        user_email="user@test.com",
        job=job,
        error_message="Class full",
        target_date=date(2026, 4, 14),
    )

    mock_send.assert_called_once()
    call_kwargs = mock_send.call_args[0][0]
    assert call_kwargs["to"] == ["admin1@test.com", "admin2@test.com"]
    assert "Yoga" in call_kwargs["subject"]
    assert "user@test.com" in call_kwargs["html"]
    assert "j-admin-1" in call_kwargs["html"]


def test_send_admin_booking_failure_email_does_nothing_with_empty_list(mocker):
    mock_send = mocker.patch("resend.Emails.send")
    job = BookingJob(
        id="j-admin-2",
        class_name="Yoga",
        target_time=time(10, 0),
        facility_name="FitnessCentre",
        facility_id="1",
        weekday=0,
        days_in_advance=1,
    )
    send_admin_booking_failure_email(
        admin_emails=[],
        user_email="user@test.com",
        job=job,
        error_message="Class full",
        target_date=date(2026, 4, 14),
    )
    mock_send.assert_not_called()
```

- [ ] **Schritt 2: Test laufen lassen (erwartet: FAIL)**

```bash
DATABASE_URL=sqlite:///eversports.db pytest tests/worker/test_worker.py::test_send_admin_booking_failure_email_calls_resend tests/worker/test_worker.py::test_send_admin_booking_failure_email_does_nothing_with_empty_list -v
```

Erwartet: `ImportError` oder `AttributeError` weil `send_admin_booking_failure_email` noch nicht existiert.

- [ ] **Schritt 3: Funktion implementieren**

In `worker/email.py` nach der Funktion `send_booking_failure_email` hinzufügen:

```python
def send_admin_booking_failure_email(
    admin_emails: list[str],
    user_email: str,
    job,
    error_message: str,
    target_date: date,
) -> None:
    """Benachrichtigt alle Admins über eine fehlgeschlagene Buchung. Best-effort."""
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

        subject = f"Buchung fehlgeschlagen: {job.class_name} am {date_str}"
        html = _templates.get_template("admin_booking_failure.html").render(
            user_email=user_email,
            job_id=job.id,
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
            "to": admin_emails,
            "subject": subject,
            "html": html,
        })
        log.info("Admin failure email sent to %s admins for job %s", len(admin_emails), job.id)
    except Exception as exc:
        log.error("Failed to send admin failure email for job %s: %s", job.id, exc)
```

- [ ] **Schritt 4: Tests laufen lassen (erwartet: PASS)**

```bash
DATABASE_URL=sqlite:///eversports.db pytest tests/worker/test_worker.py::test_send_admin_booking_failure_email_calls_resend tests/worker/test_worker.py::test_send_admin_booking_failure_email_does_nothing_with_empty_list -v
```

Erwartet: 2 Tests `PASSED`.

- [ ] **Schritt 5: Commit**

```bash
git add worker/email.py tests/worker/test_worker.py
git commit -m "feat: add send_admin_booking_failure_email function"
```

---

## Task 3: Worker anpassen — Admin-Emails laden und Funktion aufrufen

**Files:**
- Modify: `worker/worker.py:23-24` (Import), `worker/worker.py:60-67` (run-Funktion), `worker/worker.py:110-113` (Fehlerbehandlung)
- Test: `tests/worker/test_worker.py`

- [ ] **Schritt 1: Failing tests schreiben**

Am Ende von `tests/worker/test_worker.py` hinzufügen:

```python
# --- Admin-Benachrichtigungen ---

def _admin_user(db, uid="admin1", ev="ev_admin1", email="admin@b.com"):
    u = User(id=uid, eversports_user_id=ev, email=email, encrypted_password="enc", active=True, role="admin")
    db.add(u)
    db.commit()
    return u


def test_run_sends_admin_failure_email_on_booking_error(db_session, session_factory, mocker):
    """Admin soll bei Buchungsfehler benachrichtigt werden."""
    _user(db_session, uid="u_af1", ev="ev_af1", email="user_af1@b.com")
    _admin_user(db_session, uid="a_af1", ev="ev_a_af1", email="admin_af1@b.com")
    _job(db_session, jid="j_af1", uid="u_af1", weekday=1, days=4)
    friday_18 = datetime(2026, 4, 10, 18, 0)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", side_effect=RuntimeError("Class full"))
    mocker.patch("worker.worker.send_booking_failure_email")
    mock_admin_email = mocker.patch("worker.worker.send_admin_booking_failure_email")

    run(db_session, friday_18)

    mock_admin_email.assert_called_once()
    call_args = mock_admin_email.call_args[0]
    assert "admin_af1@b.com" in call_args[0]  # admin_emails
    assert call_args[1] == "user_af1@b.com"   # user_email
    assert "Class full" in call_args[3]        # error_message


def test_run_does_not_send_admin_email_on_success(db_session, session_factory, mocker):
    _user(db_session, uid="u_af2", ev="ev_af2", email="user_af2@b.com")
    _admin_user(db_session, uid="a_af2", ev="ev_a_af2", email="admin_af2@b.com")
    _job(db_session, jid="j_af2", uid="u_af2", weekday=1, days=4)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", return_value={"status": "success", "order_id": "ord-1"})
    mock_admin_email = mocker.patch("worker.worker.send_admin_booking_failure_email")

    run(db_session, datetime(2026, 4, 10, 18, 0))

    mock_admin_email.assert_not_called()


def test_run_sends_no_admin_email_when_no_admins(db_session, session_factory, mocker):
    """Wenn keine Admins existieren, kein Fehler."""
    _user(db_session, uid="u_af3", ev="ev_af3", email="user_af3@b.com")
    _job(db_session, jid="j_af3", uid="u_af3", weekday=1, days=4)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", side_effect=RuntimeError("Class full"))
    mocker.patch("worker.worker.send_booking_failure_email")
    mock_admin_email = mocker.patch("worker.worker.send_admin_booking_failure_email")

    run(db_session, datetime(2026, 4, 10, 18, 0))

    mock_admin_email.assert_called_once()
    call_args = mock_admin_email.call_args[0]
    assert call_args[0] == []  # leere admin_emails Liste
```

- [ ] **Schritt 2: Tests laufen lassen (erwartet: FAIL)**

```bash
DATABASE_URL=sqlite:///eversports.db pytest tests/worker/test_worker.py::test_run_sends_admin_failure_email_on_booking_error tests/worker/test_worker.py::test_run_does_not_send_admin_email_on_success tests/worker/test_worker.py::test_run_sends_no_admin_email_when_no_admins -v
```

Erwartet: `ImportError` oder `AttributeError` weil `send_admin_booking_failure_email` noch nicht im Worker importiert ist.

- [ ] **Schritt 3: Worker anpassen**

In `worker/worker.py` den Import in Zeile 23 ändern:

```python
from worker.email import send_booking_failure_email, send_debug_cancel_failure_email, send_admin_booking_failure_email
```

In `worker/worker.py` die Funktion `run(db: Session, now: datetime)` anpassen:

```python
def run(db: Session, now: datetime) -> None:
    admin_emails = [
        u.email
        for u in db.query(User).filter(User.role == "admin", User.active.is_(True)).all()
    ]
    log.info("Found %d active admins for notifications", len(admin_emails))

    jobs = (
        db.query(BookingJob)
        .join(User, BookingJob.user_id == User.id)
        .filter(BookingJob.enabled.is_(True), User.active.is_(True))
        .all()
    )
    log.info("Found %d active jobs", len(jobs))

    for job in jobs:
        if not is_due(job, now):
            continue

        target_date = now.date() + timedelta(days=job.days_in_advance)
        log.info("Job %s: due for %s", job.id, target_date)

        if already_booked(db, job, target_date):
            log.info("Job %s: already booked for %s, skipping", job.id, target_date)
            continue

        user = db.query(User).filter(User.id == job.user_id).first()
        if user is None:
            log.error("Job %s: user %s not found", job.id, job.user_id)
            continue

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
```

- [ ] **Schritt 4: Tests laufen lassen (erwartet: PASS)**

```bash
DATABASE_URL=sqlite:///eversports.db pytest tests/worker/test_worker.py::test_run_sends_admin_failure_email_on_booking_error tests/worker/test_worker.py::test_run_does_not_send_admin_email_on_success tests/worker/test_worker.py::test_run_sends_no_admin_email_when_no_admins -v
```

Erwartet: 3 Tests `PASSED`.

- [ ] **Schritt 5: Commit**

```bash
git add worker/worker.py tests/worker/test_worker.py
git commit -m "feat: notify admins on booking failure"
```

---

## Task 4: CLAUDE.md aktualisieren

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Schritt 1: Template-Tabelle ergänzen**

In der Tabelle unter „E-Mail-Templates" folgende Zeile hinzufügen (nach `worker/templates/email/booking_failure.html`):

```markdown
| `worker/templates/email/admin_booking_failure.html` | Worker | `user_email`, `job_id`, wie `booking_failure` |
```

- [ ] **Schritt 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: document admin_booking_failure email template"
```
