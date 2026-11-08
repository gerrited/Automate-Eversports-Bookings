# Design: Debug-Stornierung nach "Jetzt buchen" via Session-Wiederverwendung

## Kontext

Wenn eine Buchung über "Jetzt buchen" (`POST /api/jobs/{id}/execute`) ausgeführt wird und das `debug`-Flag gesetzt ist, soll die Buchung direkt im Anschluss wieder storniert werden — identisch zum Verhalten des Cron-Workers.

Der Code für diesen Pfad existiert bereits in `execute_job` (`backend/api/jobs.py:192-202`), funktioniert aber nicht zuverlässig. Die Ursache: `cancel_booking` erstellt intern einen **neuen Login** (neue `requests.Session`). Direkt nach `book_session` ist die Buchung in der frischen Session auf der Eversports-Seite (`/u`) möglicherweise noch nicht sichtbar (Eventual Consistency zwischen GraphQL-Checkout und Buchungs-Feed). Das führt zu `cancel_link = None` → `RuntimeError` → still gefangen — kein Kubernetes-Log, Buchung bleibt aktiv.

## Lösung

Dieselbe authentifizierte Session, die `book_session` verwendet, wird für die anschließende Stornierung wiederverwendet. Kein zweiter Login, kein Timing-Problem.

## Änderungen

### 1. `backend/core/booking.py`

**`book_session` Rückgabewert erweitern:**

```python
return {
    "status": "success",
    "order_id": order_result["id"],
    "event_type": matched_event_type,
    "_session": session,          # neu
}
```

Alle anderen Rückgabepfade (`already_booked`, `waitlist`, free-session fallback) geben `"_session": session` ebenfalls mit zurück.

**Neue interne Hilfsfunktion `_cancel_with_session`:**

Extrahiert aus der bestehenden `cancel_booking`-Logik, nimmt eine Session entgegen statt selbst einzuloggen:

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

`cancel_booking` (öffentlich, genutzt vom Worker) bleibt unverändert.

### 2. `backend/api/jobs.py`

Debug-Pfad in `execute_job` auf `_cancel_with_session` umstellen und Logging ergänzen:

```python
import logging
log = logging.getLogger(__name__)

# in execute_job, nach book_session:
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

Import von `_cancel_with_session` hinzufügen; Import von `cancel_booking` entfernen (nicht mehr direkt genutzt).

### 3. `tests/backend/test_api_jobs.py`

`test_execute_job_debug_mode_cancels_booking` anpassen: `book_session`-Mock gibt `_session` zurück, `_cancel_with_session` wird gemockt statt `cancel_booking`.

## Was unverändert bleibt

- `cancel_booking` (öffentliche Funktion, vom Worker verwendet) — keine Änderung
- Worker-Code — keine Änderung
- API-Schema nach außen — `_session` ist nur internes Dict-Feld, nicht im Response
