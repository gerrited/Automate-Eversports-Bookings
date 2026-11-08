# Debug-Stornierung Session-Wiederverwendung Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Debug-Buchungen via "Jetzt buchen" werden direkt nach der Buchung zuverlässig storniert, indem die bestehende authentifizierte Session wiederverwendet wird.

**Architecture:** `book_session` gibt das interne `requests.Session`-Objekt als `_session` zurück. Eine neue Funktion `_cancel_with_session` in `booking.py` enthält die Stornierlogik ohne erneuten Login. `execute_job` nutzt diese Funktion statt `cancel_booking`.

**Tech Stack:** Python, FastAPI, requests, BeautifulSoup, pytest

---

### Task 1: Tests aktualisieren und Implementierung ergänzen

**Files:**
- Modify: `tests/backend/test_api_jobs.py:201-223`
- Modify: `backend/core/booking.py` (nach `cancel_booking`, alle `return`-Statements von `book_session`)
- Modify: `backend/api/jobs.py:1-18` (Imports, Logging) und `jobs.py:192-202` (Debug-Pfad)

- [ ] **Step 1: Test für erfolgreiche Debug-Stornierung aktualisieren**

In `tests/backend/test_api_jobs.py` den bestehenden Test `test_execute_job_debug_mode_cancels_booking` (Zeile 201) ersetzen und einen neuen Fehler-Test ergänzen:

```python
def test_execute_job_debug_mode_cancels_booking(client, db_session):
    from unittest.mock import MagicMock
    user = _create_user(db_session)
    resp = client.post(
        "/api/jobs",
        json={
            "weekday": 1, "target_time": "18:00:00", "facility_id": "73041",
            "facility_name": "CrossFit Rabbit Hole", "class_name": "CrossFit",
            "days_in_advance": 4, "debug": True,
        },
        headers=_auth_header(user.id),
    )
    job_id = resp.json()["id"]

    mock_session = MagicMock()
    with patch("backend.api.jobs.book_session", return_value={"status": "success", "order_id": "ord-1", "event_type": "class", "_session": mock_session}), \
         patch("backend.api.jobs.decrypt", return_value="password123"), \
         patch("backend.api.jobs._cancel_with_session") as mock_cancel:
        resp = client.post(f"/api/jobs/{job_id}/execute", headers=_auth_header(user.id))

    assert resp.status_code == 200
    assert resp.json()["status"] == "success"
    assert "[DEBUG]" in resp.json()["message"]
    mock_cancel.assert_called_once_with(
        session=mock_session,
        class_name="CrossFit",
        facility_id="73041",
    )


def test_execute_job_debug_cancel_failure(client, db_session):
    from unittest.mock import MagicMock
    user = _create_user(db_session)
    resp = client.post(
        "/api/jobs",
        json={
            "weekday": 1, "target_time": "18:00:00", "facility_id": "73041",
            "facility_name": "CrossFit Rabbit Hole", "class_name": "CrossFit",
            "days_in_advance": 4, "debug": True,
        },
        headers=_auth_header(user.id),
    )
    job_id = resp.json()["id"]

    mock_session = MagicMock()
    with patch("backend.api.jobs.book_session", return_value={"status": "success", "order_id": "ord-1", "event_type": "class", "_session": mock_session}), \
         patch("backend.api.jobs.decrypt", return_value="password123"), \
         patch("backend.api.jobs._cancel_with_session", side_effect=RuntimeError("No upcoming booking found")):
        resp = client.post(f"/api/jobs/{job_id}/execute", headers=_auth_header(user.id))

    assert resp.status_code == 200
    assert resp.json()["status"] == "success"
    assert "Stornierung fehlgeschlagen" in resp.json()["message"]
```

- [ ] **Step 2: Tests ausführen — müssen FEHLSCHLAGEN**

```bash
pytest tests/backend/test_api_jobs.py::test_execute_job_debug_mode_cancels_booking tests/backend/test_api_jobs.py::test_execute_job_debug_cancel_failure -v
```

Erwartetes Ergebnis: FAIL mit `AttributeError: <module 'backend.api.jobs'> does not have the attribute '_cancel_with_session'`

- [ ] **Step 3: `_cancel_with_session` in `backend/core/booking.py` ergänzen**

Die Funktion direkt nach `cancel_booking` (nach Zeile 343) einfügen:

```python
def _cancel_with_session(
    session: requests.Session,
    class_name: str,
    facility_id: str,
) -> None:
    resp = session.get(BASE_URL + "/u", timeout=TIMEOUT)
    if not resp.ok:
        raise _http_error(resp)
    soup = BeautifulSoup(resp.text, "html.parser")

    numeric_facility_id = _resolve_facility_id(facility_id, session)

    cancel_link = None
    for link in soup.find_all("a", class_="cancel-link-event"):
        if str(link.get("data-facilityid", "")) != numeric_facility_id:
            continue
        h4 = link.find_parent("li")
        if h4 and class_name and class_name not in h4.get_text():
            continue
        cancel_link = link
        break

    if cancel_link is None:
        raise RuntimeError(
            f"No upcoming booking found to cancel for {class_name} at facility {facility_id}"
        )

    resp = session.post(
        BASE_URL + "/api/event/cancel",
        data={
            "eventId": cancel_link["data-event"],
            "eventParticipantId": cancel_link["data-eventparticipant"],
            "facilityId": cancel_link["data-facilityid"],
            "sessionId": cancel_link["data-session"],
            "isLateCancellation": "false",
        },
        timeout=TIMEOUT,
    )
    if not resp.ok:
        raise _http_error(resp)
```

- [ ] **Step 4: `book_session` Return-Statements um `_session` ergänzen**

In `backend/core/booking.py` alle vier `return`-Statements in `book_session` um `"_session": session` erweitern:

Zeile 258 (already_booked):
```python
return {"status": "already_booked", "order_id": None, "event_type": matched_event_type, "_session": session}
```

Zeile 264 (waitlist):
```python
return {"status": "waitlist", "order_id": None, "event_type": matched_event_type, "_session": session}
```

Zeile 287 (success, free session):
```python
return {"status": "success", "order_id": cart_id, "event_type": matched_event_type, "_session": session}
```

Zeile 290 (success, paid):
```python
return {"status": "success", "order_id": order_result["id"], "event_type": matched_event_type, "_session": session}
```

- [ ] **Step 5: `execute_job` in `backend/api/jobs.py` aktualisieren**

Import in Zeile 11 ändern (`cancel_booking` → `_cancel_with_session`):
```python
from backend.core.booking import book_session, _cancel_with_session
```

`import logging` in den Stdlib-Import-Block (nach `from __future__ import annotations`, vor `from datetime`) einfügen:
```python
import logging
```

`log`-Variable nach dem letzten Import-Block (nach `from backend.schemas.log import LogResponse`) ergänzen:
```python
log = logging.getLogger(__name__)
```

Den Debug-Pfad (Zeilen 192-202) ersetzen:
```python
        if status == "success" and job.debug:
            try:
                _cancel_with_session(
                    session=result["_session"],
                    class_name=job.class_name,
                    facility_id=job.facility_id,
                )
                message = f"[DEBUG] gebucht und storniert für {target_date}"
                log.info("Job %s: debug booking cancelled", job.id)
            except Exception as cancel_exc:
                message = f"[DEBUG] gebucht, Stornierung fehlgeschlagen: {cancel_exc}"
                log.error("Job %s: debug cancel failed — %s", job.id, cancel_exc)
```

- [ ] **Step 6: Alle Tests ausführen — müssen BESTEHEN**

```bash
pytest tests/ -x -v
```

Erwartetes Ergebnis: alle Tests grün, insbesondere:
- `test_execute_job_debug_mode_cancels_booking` — PASS
- `test_execute_job_debug_cancel_failure` — PASS
- `test_execute_job_success` — PASS (Mock gibt kein `_session`, debug=False → Pfad nicht betreten)
- `test_book_session_joins_waitlist_when_fully_booked` — PASS (prüft nur `result["status"]`)

- [ ] **Step 7: Commit**

```bash
git add backend/core/booking.py backend/api/jobs.py tests/backend/test_api_jobs.py
git commit -m "fix: reuse booking session for debug cancel in execute_job"
```
