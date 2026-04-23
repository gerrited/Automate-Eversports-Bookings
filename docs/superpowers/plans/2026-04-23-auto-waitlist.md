# Auto-Warteliste Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wenn `book_session()` scheitert weil ein Kurs voll ist, wird der Nutzer automatisch auf die Warteliste eingetragen, der Status `"waitlist"` ins Log geschrieben und eine Benachrichtigungs-E-Mail gesendet.

**Architecture:** `join_waitlist()` in `backend/core/booking.py` ruft die verifizierte `addToWaitingList(eventBookableItemId: ID!)`-Mutation auf. `book_session()` erkennt FULLY_BOOKED-Fehlermeldungen und delegiert an `join_waitlist()`. Der Worker behandelt den neuen Status `"waitlist"` analog zu `"already_booked"` — kein Fehler, separate Benachrichtigungs-E-Mail.

**Tech Stack:** Python/requests (backend), Jinja2 (E-Mail-Templates), Resend (E-Mail-Versand), React/TypeScript (Frontend), pytest/pytest-mock (Tests)

---

## Dateiübersicht

| Datei | Aktion |
|---|---|
| `backend/core/booking.py` | Neue Funktion `join_waitlist()`, FULLY_BOOKED-Erkennung in `book_session()` |
| `worker/templates/email/booking_waitlist.html` | Neu erstellen |
| `worker/email.py` | Neue Funktion `send_waitlist_notification()` |
| `worker/worker.py` | `"waitlist"`-Status in `process_job()` + Import |
| `frontend/src/components/LogDrawer.tsx` | `"waitlist"` in `statusColor` und `statusLabel` |
| `tests/backend/test_booking_waitlist.py` | Neu erstellen — Tests für `join_waitlist()` |
| `tests/backend/test_email_templates.py` | `test_worker_booking_waitlist_renders()` ergänzen |
| `tests/worker/test_worker.py` | Tests für `"waitlist"`-Status in `process_job()` und `run()` |

---

### Task 1: `join_waitlist()` in booking.py

**Files:**
- Modify: `backend/core/booking.py`
- Create: `tests/backend/test_booking_waitlist.py`

- [ ] **Schritt 1: Failing-Test schreiben**

Datei `tests/backend/test_booking_waitlist.py` erstellen:

```python
import pytest
from unittest.mock import MagicMock
from backend.core.booking import join_waitlist


def test_join_waitlist_returns_id_on_success():
    session = MagicMock()
    gql_response = {"addToWaitingList": {"id": "abc-123", "__typename": "WaitingList"}}

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("backend.core.booking._gql", lambda *a, **kw: gql_response)
        result = join_waitlist(session, "abc-123")

    assert result == "abc-123"


def test_join_waitlist_raises_on_expected_errors():
    session = MagicMock()
    gql_response = {
        "addToWaitingList": {
            "__typename": "ExpectedErrors",
            "errors": [{"message": "Warteliste nicht verfügbar"}],
        }
    }

    with pytest.MonkeyPatch().context() as mp:
        mp.setattr("backend.core.booking._gql", lambda *a, **kw: gql_response)
        with pytest.raises(RuntimeError, match="Waitlist join failed"):
            join_waitlist(session, "abc-123")
```

- [ ] **Schritt 2: Test ausführen und Fehler bestätigen**

```bash
pytest tests/backend/test_booking_waitlist.py -v
```

Erwartet: `ImportError` oder `AttributeError` — `join_waitlist` existiert noch nicht.

- [ ] **Schritt 3: `join_waitlist()` implementieren**

In `backend/core/booking.py` nach der `_resolve_facility_id`-Funktion (nach Zeile 77) einfügen:

```python
_WAITLIST_MUTATION = """
mutation AddToWaitingList($eventBookableItemId: ID!) {
  addToWaitingList(eventBookableItemId: $eventBookableItemId) {
    ... on WaitingList { id __typename }
    ... on ExpectedErrors { errors { message __typename } __typename }
    __typename
  }
}
"""


def join_waitlist(session: requests.Session, event_bookable_item_id: str) -> str:
    """Trägt den eingeloggten Nutzer auf die Warteliste ein.
    Gibt die WaitingList-ID (= event_bookable_item_id) zurück.
    Wirft RuntimeError bei ExpectedErrors.
    """
    data = _gql(session, "AddToWaitingList", _WAITLIST_MUTATION, {"eventBookableItemId": event_bookable_item_id})
    result = data["addToWaitingList"]
    if result["__typename"] == "ExpectedErrors":
        msgs = "; ".join(e["message"] for e in result["errors"])
        raise RuntimeError(f"Waitlist join failed: {msgs}")
    return result["id"]
```

- [ ] **Schritt 4: Tests ausführen und Erfolg bestätigen**

```bash
pytest tests/backend/test_booking_waitlist.py -v
```

Erwartet: beide Tests PASS.

- [ ] **Schritt 5: Commit**

```bash
git add backend/core/booking.py tests/backend/test_booking_waitlist.py
git commit -m "feat: add join_waitlist() to booking.py"
```

---

### Task 2: FULLY_BOOKED-Erkennung in `book_session()`

**Files:**
- Modify: `backend/core/booking.py:229-235`
- Modify: `tests/backend/test_booking_waitlist.py`

- [ ] **Schritt 1: Failing-Test schreiben**

In `tests/backend/test_booking_waitlist.py` ergänzen:

```python
from backend.core.booking import book_session
from unittest.mock import patch, MagicMock
from datetime import date


def _make_session_mock():
    session = MagicMock()
    session.get.return_value.ok = True
    session.get.return_value.json.return_value = {
        "data": {
            "html": """
            <ul>
              <li data-uuid="item-full-123">
                <h3 data-day="2026-04-14"></h3>
                <div class="session-time">18:00 Uhr</div>
                <div class="session-name">CrossFit</div>
              </li>
            </ul>
            """
        }
    }
    return session


def test_book_session_joins_waitlist_when_fully_booked(mocker):
    mocker.patch("backend.core.booking.eversports_login", return_value={
        "user_id": "u1",
        "session": _make_session_mock(),
        "avatar_url": None,
    })
    mocker.patch("backend.core.booking._resolve_facility_id", return_value="73041")

    cart_response = {
        "createCartFromEventBookableItem": {
            "__typename": "ExpectedErrors",
            "errors": [{"id": "1", "message": "ausgebucht", "__typename": "ExpectedError"}],
        }
    }
    waitlist_response = {
        "addToWaitingList": {"id": "item-full-123", "__typename": "WaitingList"}
    }

    call_count = {"n": 0}
    def fake_gql(session, op, query, variables):
        call_count["n"] += 1
        if call_count["n"] == 1:
            return cart_response
        return waitlist_response

    mocker.patch("backend.core.booking._gql", side_effect=fake_gql)

    result = book_session(
        email="a@b.com",
        password="pw",
        target_date=date(2026, 4, 14),
        target_time="18:00",
        facility_id="73041",
        class_name="CrossFit",
    )

    assert result["status"] == "waitlist"
    assert result["order_id"] is None


def test_book_session_raises_on_other_cart_errors(mocker):
    mocker.patch("backend.core.booking.eversports_login", return_value={
        "user_id": "u1",
        "session": _make_session_mock(),
        "avatar_url": None,
    })
    mocker.patch("backend.core.booking._resolve_facility_id", return_value="73041")

    cart_response = {
        "createCartFromEventBookableItem": {
            "__typename": "ExpectedErrors",
            "errors": [{"id": "1", "message": "Zahlung abgelehnt", "__typename": "ExpectedError"}],
        }
    }
    mocker.patch("backend.core.booking._gql", return_value=cart_response)

    with pytest.raises(RuntimeError, match="Cart creation failed"):
        book_session(
            email="a@b.com",
            password="pw",
            target_date=date(2026, 4, 14),
            target_time="18:00",
            facility_id="73041",
            class_name="CrossFit",
        )
```

- [ ] **Schritt 2: Tests ausführen und Fehler bestätigen**

```bash
pytest tests/backend/test_booking_waitlist.py::test_book_session_joins_waitlist_when_fully_booked -v
```

Erwartet: FAIL — `book_session()` gibt noch kein `"waitlist"` zurück.

- [ ] **Schritt 3: FULLY_BOOKED-Erkennung in `book_session()` implementieren**

In `backend/core/booking.py`, den Block ab Zeile 229 ersetzen:

```python
    if cart_result["__typename"] == "ExpectedErrors":
        for error in cart_result["errors"]:
            msg = error["message"].lower()
            if "already" in msg or "bereits" in msg:
                return {"status": "already_booked", "order_id": None, "event_type": matched_event_type}
        full_keywords = ("fully booked", "fully_booked", "ausgebucht", "sold out", "no spots")
        for error in cart_result["errors"]:
            msg = error["message"].lower()
            if any(kw in msg for kw in full_keywords):
                join_waitlist(session, bookable_item_id)
                return {"status": "waitlist", "order_id": None, "event_type": matched_event_type}
        msgs = "; ".join(e["message"] for e in cart_result["errors"])
        raise RuntimeError(f"Cart creation failed: {msgs}")
```

- [ ] **Schritt 4: Tests ausführen und Erfolg bestätigen**

```bash
pytest tests/backend/test_booking_waitlist.py -v
```

Erwartet: alle Tests PASS.

- [ ] **Schritt 5: Gesamte Backend-Tests sicherstellen**

```bash
pytest tests/ -x
```

Erwartet: alle Tests PASS.

- [ ] **Schritt 6: Commit**

```bash
git add backend/core/booking.py tests/backend/test_booking_waitlist.py
git commit -m "feat: detect FULLY_BOOKED in book_session and join waitlist"
```

---

### Task 3: E-Mail-Template `booking_waitlist.html`

**Files:**
- Create: `worker/templates/email/booking_waitlist.html`
- Modify: `tests/backend/test_email_templates.py`

- [ ] **Schritt 1: Failing-Test schreiben**

In `tests/backend/test_email_templates.py` am Ende ergänzen:

```python
def test_worker_booking_waitlist_renders():
    html = _env(WORKER_DIR).get_template("booking_waitlist.html").render(
        class_name="CrossFit",
        time_str="18:00",
        weekday_str="Freitag",
        date_str="10.04.2026",
        facility_name="Sport-Club Hundsmühlen e.V.",
        frontend_url=FRONTEND_URL,
    )
    assert "CrossFit" in html
    assert "18:00" in html
    assert "Freitag" in html
    assert "10.04.2026" in html
    assert "Sport-Club Hundsmühlen e.V." in html
    assert "Warteliste" in html
    assert FRONTEND_URL in html
    assert "#004349" in html
```

- [ ] **Schritt 2: Test ausführen und Fehler bestätigen**

```bash
pytest tests/backend/test_email_templates.py::test_worker_booking_waitlist_renders -v
```

Erwartet: FAIL — Template existiert noch nicht.

- [ ] **Schritt 3: Template erstellen**

Datei `worker/templates/email/booking_waitlist.html` erstellen:

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Auf der Warteliste</title>
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
      <p style="color:#f1f5f9;font-size:18px;font-weight:600;margin:0 0 12px;">Du bist auf der Warteliste</p>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 16px;">Der Kurs war leider ausgebucht. Du wurdest automatisch auf die Warteliste eingetragen.</p>
      <div style="background:#021214;border-radius:6px;padding:12px 16px;margin:0 0 16px;font-size:13px;color:#94a3b8;line-height:2;">
        <strong style="color:#cbd5e1;">Kurs</strong>&nbsp;&nbsp;{{ class_name }} — {{ time_str }} Uhr<br>
        <strong style="color:#cbd5e1;">Tag&nbsp;&nbsp;</strong>&nbsp;{{ weekday_str }}, {{ date_str }}<br>
        <strong style="color:#cbd5e1;">Ort&nbsp;&nbsp;</strong>&nbsp;{{ facility_name }}
      </div>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 20px;">Eversports benachrichtigt dich direkt, sobald ein Platz frei wird.</p>
      <a href="{{ frontend_url }}" style="display:inline-block;background:#004349;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 22px;border-radius:8px;">Zur App →</a>
    </div>

    <p style="color:#374151;font-size:11px;text-align:center;margin:16px 0 0;">FOReversports · Automatische Buchungsbenachrichtigung</p>
  </div>
</body>
</html>
```

- [ ] **Schritt 4: Test ausführen und Erfolg bestätigen**

```bash
pytest tests/backend/test_email_templates.py -v
```

Erwartet: alle Tests PASS.

- [ ] **Schritt 5: Commit**

```bash
git add worker/templates/email/booking_waitlist.html tests/backend/test_email_templates.py
git commit -m "feat: add booking_waitlist email template"
```

---

### Task 4: `send_waitlist_notification()` in `worker/email.py`

**Files:**
- Modify: `worker/email.py`

- [ ] **Schritt 1: Funktion hinzufügen**

In `worker/email.py` am Ende ergänzen:

```python
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
```

- [ ] **Schritt 2: Import-Check**

```bash
python3 -c "from worker.email import send_waitlist_notification; print('OK')"
```

Erwartet: `OK`

- [ ] **Schritt 3: Commit**

```bash
git add worker/email.py
git commit -m "feat: add send_waitlist_notification to worker/email.py"
```

---

### Task 5: `"waitlist"`-Status in `worker/worker.py`

**Files:**
- Modify: `worker/worker.py:24` (Import), `worker/worker.py:112-120` (process_job)
- Modify: `tests/worker/test_worker.py`

- [ ] **Schritt 1: Failing-Tests schreiben**

In `tests/worker/test_worker.py` am Ende ergänzen:

```python
def test_process_job_logs_waitlist_status(db_session, session_factory, mocker):
    _user(db_session, uid="wl1", ev="ev_wl1", email="wl1@b.com")
    _job(db_session, jid="jwl1", uid="wl1", weekday=1, days=4)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", return_value={"status": "waitlist", "order_id": None, "event_type": "class"})
    mock_waitlist_email = mocker.patch("worker.worker.send_waitlist_notification")
    mock_failure_email = mocker.patch("worker.worker.send_booking_failure_email")

    process_job("jwl1", datetime(2026, 4, 10, 18, 0), session_factory, [])

    log_entry = db_session.query(BookingLog).filter(BookingLog.job_id == "jwl1").first()
    assert log_entry.status == "waitlist"
    mock_waitlist_email.assert_called_once()
    mock_failure_email.assert_not_called()


def test_run_sends_waitlist_email_on_waitlist_status(db_session, session_factory, mocker):
    _user(db_session, uid="wl2", ev="ev_wl2", email="wl2@b.com")
    _job(db_session, jid="jwl2", uid="wl2", weekday=1, days=4)
    friday_18 = datetime(2026, 4, 10, 18, 0)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", return_value={"status": "waitlist", "order_id": None, "event_type": "class"})
    mock_waitlist_email = mocker.patch("worker.worker.send_waitlist_notification")

    run(friday_18, session_factory)

    mock_waitlist_email.assert_called_once()
    log_entry = db_session.query(BookingLog).filter(BookingLog.job_id == "jwl2").first()
    assert log_entry.status == "waitlist"


def test_one_time_job_not_deleted_on_waitlist(db_session, session_factory, mocker):
    _user(db_session, uid="wl3", ev="ev_wl3", email="wl3@b.com")
    _job(db_session, jid="jwl3", uid="wl3", weekday=1, days=4, one_time=True)

    mocker.patch("worker.worker.decrypt", return_value="pass")
    mocker.patch("worker.worker.book_session", return_value={"status": "waitlist", "order_id": None, "event_type": "class"})
    mocker.patch("worker.worker.send_waitlist_notification")

    process_job("jwl3", datetime(2026, 4, 10, 18, 0), session_factory, [])

    remaining = db_session.query(BookingJob).filter(BookingJob.id == "jwl3").first()
    assert remaining is not None
```

- [ ] **Schritt 2: Tests ausführen und Fehler bestätigen**

```bash
pytest tests/worker/test_worker.py::test_process_job_logs_waitlist_status -v
```

Erwartet: FAIL — `send_waitlist_notification` nicht importiert, `"waitlist"` nicht behandelt.

- [ ] **Schritt 3: Import in `worker/worker.py` ergänzen**

Zeile 24 ersetzen:

```python
from worker.email import send_booking_failure_email, send_admin_booking_failure_email, send_debug_cancel_failure_email, send_waitlist_notification
```

- [ ] **Schritt 4: `process_job()` — `"waitlist"`-Zweig hinzufügen**

In `worker/worker.py`, den Block nach Zeile 100 (nach dem `log.info`-Call für Status/order_id) ergänzen. Den gesamten try-Block ab Zeile 83 wie folgt ersetzen:

```python
        try:
            password = decrypt(user.encrypted_password)
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
            if result["status"] == "success" and result.get("event_type") and job.event_type != result["event_type"]:
                job.event_type = result["event_type"]
                db.add(job)
            if result["status"] == "waitlist":
                try:
                    send_waitlist_notification(user.email, job, target_date)
                except Exception as email_exc:
                    log.error("Job %s: could not send waitlist notification — %s", job.id, email_exc)
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
            if admin_emails:
                try:
                    send_admin_booking_failure_email(admin_emails, user.email, job, str(exc), target_date)
                except Exception as email_exc:
                    log.error("Job %s: could not send admin failure email — %s", job.id, email_exc)
```

Außerdem in Zeile 143 den One-Time-Job-Lösch-Check anpassen — `"waitlist"` soll den Job **nicht** löschen:

```python
        if job.one_time and log_entry.status in ("success", "already_booked"):
```

(Bleibt unverändert — `"waitlist"` ist bewusst nicht drin.)

- [ ] **Schritt 5: Tests ausführen**

```bash
pytest tests/worker/test_worker.py -v
```

Erwartet: alle Tests PASS.

- [ ] **Schritt 6: Alle Tests ausführen**

```bash
pytest tests/ -x
```

Erwartet: alle Tests PASS.

- [ ] **Schritt 7: Commit**

```bash
git add worker/worker.py tests/worker/test_worker.py
git commit -m "feat: handle waitlist status in worker process_job"
```

---

### Task 6: Frontend — `"waitlist"`-Badge in LogDrawer

**Files:**
- Modify: `frontend/src/components/LogDrawer.tsx:12-21`

- [ ] **Schritt 1: `statusColor` und `statusLabel` ergänzen**

In `frontend/src/components/LogDrawer.tsx` die beiden Record-Objekte ab Zeile 12 ersetzen:

```typescript
const statusColor: Record<string, string> = {
  success: 'text-green-400',
  failed: 'text-red-400',
  already_booked: 'text-slate-400',
  waitlist: 'text-yellow-400',
};

const statusLabel: Record<string, string> = {
  success: '✓ Gebucht',
  failed: '✗ Fehler',
  already_booked: '→ Bereits gebucht',
  waitlist: '⏳ Warteliste',
};
```

- [ ] **Schritt 2: TypeScript-Check**

```bash
cd frontend && npm run build 2>&1 | tail -10
```

Erwartet: kein TypeScript-Fehler.

- [ ] **Schritt 3: Commit**

```bash
git add frontend/src/components/LogDrawer.tsx
git commit -m "feat: show waitlist badge in log drawer"
```

---

### Task 7: Testscript aufräumen

**Files:**
- Delete: `test_waitlist.py`

- [ ] **Schritt 1: Testscript löschen**

```bash
git rm test_waitlist.py
git commit -m "chore: remove temporary waitlist test script"
```

---

## Self-Review

**Spec-Abdeckung:**
- ✅ `join_waitlist()` mit `addToWaitingList(eventBookableItemId)` — Task 1
- ✅ FULLY_BOOKED-Erkennung in `book_session()` — Task 2
- ✅ `"waitlist"`-Status wird zurückgegeben — Task 2
- ✅ E-Mail-Template mit Wartelisten-Hinweis — Task 3
- ✅ `send_waitlist_notification()` — Task 4
- ✅ Worker loggt `"waitlist"`, sendet kein Fehler-Mail — Task 5
- ✅ One-time-Jobs bleiben bei `"waitlist"` erhalten — Task 5 (Schritt 4)
- ✅ Frontend zeigt `"waitlist"` Badge — Task 6
- ✅ Testscript wird entfernt — Task 7

**Typ-Konsistenz:**
- `join_waitlist(session, event_bookable_item_id)` — in Task 1 definiert, in Task 2 aufgerufen ✅
- `send_waitlist_notification(user_email, job, target_date)` — in Task 4 definiert, in Task 5 importiert + aufgerufen ✅
- `result["status"] == "waitlist"` — konsistent in Task 2 (Rückgabe) und Task 5 (Prüfung) ✅

**Placeholder-Scan:** keine TBD/TODO gefunden. Alle Code-Blöcke vollständig.
