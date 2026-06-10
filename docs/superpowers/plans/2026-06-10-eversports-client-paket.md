# Eversports-Client als Paket — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `backend/core/booking.py` (465 Zeilen, gewachsen) wird zu einem Paket `backend/eversports/` mit Fehler-Taxonomie, reinen Parsing-Funktionen und Contract-Tests — der einzige Code, der die Eversports-Plattform berührt.

**Architecture:** Vier Module mit klaren Grenzen: `errors.py` (Taxonomie), `classify.py` (Fehlertext-Klassifikation — die heikelste Stelle des Systems), `parsing.py` (reine HTML-Parser, testbar mit Fixtures), `client.py` (HTTP/GraphQL-Flows). `backend/core/booking.py` bleibt während der Migration als Re-Export-Shim bestehen und wird am Ende gelöscht. Alle Funktionssignaturen bleiben unverändert — Aufrufer (Worker, API) ändern nur Imports.

**Tech Stack:** Python 3.13, requests, BeautifulSoup4, pytest. Keine neuen Abhängigkeiten.

**Voraussetzung:** PR #18 ist gemerged (BookingStatus-Enum in `backend/core/status.py` muss existieren).

---

## ⚠️ Die heikelste Stelle zuerst verstehen

`backend/core/booking.py:255-267` klassifiziert Eversports-GraphQL-Fehler über **Substring-Matching auf lokalisierten Texten**:

- `"already" in msg or "bereits" in msg` → Status `already_booked`
- eines von `("fully booked", "fully_booked", "ausgebucht", "sold out", "no spots")` → Warteliste beitreten
- alles andere → harter Fehler

**Warum heikel:** Ändert Eversports einen Fehlertext (oder liefert eine andere Sprache aus), wird eine volle Klasse als harter Fehler behandelt statt als Warteliste — oder eine Doppelbuchung nicht erkannt. Dieses Matching darf NIE inline bleiben; es kommt in eine einzige Funktion (`classify.py`) mit erschöpfenden Tests, damit Drift an genau einer Stelle auffällt und korrigiert wird. Beim Implementieren: Verhalten exakt erhalten, keine Keywords „verbessern".

## File Structure

| Datei | Verantwortung |
|---|---|
| `backend/eversports/__init__.py` | Public API: Re-Exports von Client-Funktionen und Fehlern |
| `backend/eversports/errors.py` | Exception-Taxonomie (`EversportsError` + Subklassen) |
| `backend/eversports/classify.py` | Klassifikation lokalisierter Fehlertexte → `CartOutcome` |
| `backend/eversports/parsing.py` | Reine HTML-Parser (Kalender-Slots, /u-Buchungsliste, facility-ID-Regex) |
| `backend/eversports/client.py` | Login, GraphQL-Mutationen, Buchungs-/Storno-Flows |
| `tests/eversports/fixtures/*.html` | HTML-Snapshots als Contract-Fixtures |
| `tests/eversports/test_classify.py`, `test_parsing.py`, `test_client.py` | Unit-/Contract-Tests |
| `backend/core/booking.py` | wird Shim (Task 6), dann gelöscht (Task 8) |

---

### Task 1: Fehler-Taxonomie

**Files:**
- Create: `backend/eversports/__init__.py` (leer anlegen)
- Create: `backend/eversports/errors.py`
- Test: `tests/eversports/__init__.py` (leer), `tests/eversports/test_errors.py`

- [ ] **Step 1: Failing Test schreiben**

```python
# tests/eversports/test_errors.py
import pytest

from backend.eversports.errors import (
    EversportsError, AuthFailed, SlotNotFound, MarkupDrift, PlatformError,
)


def test_alle_fehler_erben_von_eversports_error():
    for cls in (AuthFailed, SlotNotFound, MarkupDrift, PlatformError):
        assert issubclass(cls, EversportsError)


def test_eversports_error_erbt_von_runtime_error():
    # Übergangs-Kompatibilität: bestehende `except RuntimeError`-Handler
    # (z.B. worker/worker.py) fangen die neuen Fehler weiterhin
    assert issubclass(EversportsError, RuntimeError)


def test_markup_drift_traegt_kontext():
    err = MarkupDrift("data-id nicht gefunden", page="/scl/crossfit-rabbit-hole")
    assert err.page == "/scl/crossfit-rabbit-hole"
    assert "data-id" in str(err)
```

- [ ] **Step 2: Test ausführen, Fehlschlag verifizieren**

Run: `venv/bin/pytest tests/eversports/test_errors.py -v`
Expected: FAIL mit `ModuleNotFoundError: No module named 'backend.eversports'`

- [ ] **Step 3: Implementierung**

```python
# backend/eversports/errors.py
"""Fehler-Taxonomie für die Eversports-Plattform.

Erbt von RuntimeError, damit bestehende `except RuntimeError`-Handler
(Worker, API) während der Migration weiter funktionieren.
"""


class EversportsError(RuntimeError):
    """Basisklasse aller Eversports-Fehler."""


class AuthFailed(EversportsError):
    """Login fehlgeschlagen (falsche Credentials oder Plattform lehnt ab)."""


class SlotNotFound(EversportsError):
    """Kurs/Slot im Kalender nicht gefunden (Name, Zeit oder Datum passen nicht)."""


class PlatformError(EversportsError):
    """HTTP- oder GraphQL-Fehler der Plattform (5xx, ExpectedErrors ohne bekannte Klassifikation)."""


class MarkupDrift(EversportsError):
    """Erwartete HTML-Struktur nicht gefunden — Eversports hat das Markup geändert.

    Signal für: Parser-Fixtures aktualisieren, Selektoren anpassen.
    """

    def __init__(self, message: str, page: str = ""):
        super().__init__(f"{message} (Seite: {page})" if page else message)
        self.page = page
```

- [ ] **Step 4: Test ausführen, Erfolg verifizieren**

Run: `venv/bin/pytest tests/eversports/test_errors.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add backend/eversports/ tests/eversports/
git commit -m "feat(eversports): Fehler-Taxonomie für das Client-Paket"
```

---

### Task 2: classify.py — die lokalisierten Fehler-Strings isolieren

**Files:**
- Create: `backend/eversports/classify.py`
- Test: `tests/eversports/test_classify.py`
- Quelle des Verhaltens: `backend/core/booking.py:255-267` (NICHT ändern in diesem Task)

- [ ] **Step 1: Failing Tests schreiben — erschöpfend, ein Test pro Keyword**

```python
# tests/eversports/test_classify.py
import pytest

from backend.eversports.classify import CartOutcome, classify_cart_errors


# --- already_booked ---

@pytest.mark.parametrize("msg", [
    "You have already booked this session",
    "Du hast diese Session bereits gebucht",
    "ALREADY booked",  # case-insensitiv
])
def test_bereits_gebucht(msg):
    assert classify_cart_errors([msg]) is CartOutcome.ALREADY_BOOKED


# --- voll → Warteliste ---

@pytest.mark.parametrize("msg", [
    "This class is fully booked",
    "Error: fully_booked",
    "Diese Klasse ist ausgebucht",
    "Sold out",
    "There are no spots left",
])
def test_ausgebucht(msg):
    assert classify_cart_errors([msg]) is CartOutcome.SLOT_FULL


# --- Prioritäten und Unbekanntes ---

def test_already_hat_vorrang_vor_full():
    # Reihenfolge wie im Original: erst already-Schleife über alle Messages, dann full
    assert classify_cart_errors(["sold out", "already booked"]) is CartOutcome.ALREADY_BOOKED


def test_unbekannte_meldung_ist_unknown():
    assert classify_cart_errors(["Payment method required"]) is CartOutcome.UNKNOWN


def test_leere_liste_ist_unknown():
    assert classify_cart_errors([]) is CartOutcome.UNKNOWN
```

- [ ] **Step 2: Fehlschlag verifizieren**

Run: `venv/bin/pytest tests/eversports/test_classify.py -v`
Expected: FAIL mit `ModuleNotFoundError`

- [ ] **Step 3: Implementierung — Verhalten 1:1 aus booking.py:255-267 übernehmen**

```python
# backend/eversports/classify.py
"""Klassifikation der Eversports-GraphQL-Fehlertexte.

⚠️ HEIKELSTE STELLE DES SYSTEMS: Eversports liefert Fehler als lokalisierte
Freitexte. Dieses Modul ist die EINZIGE Stelle, die darauf matcht. Wenn eine
Buchung fälschlich als harter Fehler statt als Warteliste/Doppelbuchung endet,
fehlt hier ein Keyword — Keyword ergänzen, Test ergänzen, fertig.

Verhalten exakt übernommen aus backend/core/booking.py (Stand 2026-06-10):
already-Prüfung läuft VOR der full-Prüfung über alle Messages.
"""
from enum import Enum, auto

_ALREADY_KEYWORDS = ("already", "bereits")
_FULL_KEYWORDS = ("fully booked", "fully_booked", "ausgebucht", "sold out", "no spots")


class CartOutcome(Enum):
    ALREADY_BOOKED = auto()
    SLOT_FULL = auto()
    UNKNOWN = auto()


def classify_cart_errors(messages: list[str]) -> CartOutcome:
    lowered = [m.lower() for m in messages]
    for msg in lowered:
        if any(kw in msg for kw in _ALREADY_KEYWORDS):
            return CartOutcome.ALREADY_BOOKED
    for msg in lowered:
        if any(kw in msg for kw in _FULL_KEYWORDS):
            return CartOutcome.SLOT_FULL
    return CartOutcome.UNKNOWN
```

- [ ] **Step 4: Erfolg verifizieren**

Run: `venv/bin/pytest tests/eversports/test_classify.py -v`
Expected: 10 passed

- [ ] **Step 5: Commit**

```bash
git add backend/eversports/classify.py tests/eversports/test_classify.py
git commit -m "feat(eversports): Fehlertext-Klassifikation isoliert und erschöpfend getestet"
```

---

### Task 3: parsing.py — reine HTML-Parser mit Contract-Fixtures

**Files:**
- Create: `backend/eversports/parsing.py`
- Create: `tests/eversports/fixtures/calendar_week.html`
- Create: `tests/eversports/fixtures/profile_bookings.html`
- Test: `tests/eversports/test_parsing.py`
- Quelle: Kalender-Parsing aus `backend/core/booking.py:209-222`, /u-Parsing aus `:387-433`, facility-Regex aus `:25` und `:63-78`

- [ ] **Step 1: Fixtures anlegen — synthetisches HTML, das exakt die heutigen Selektoren bedient**

```html
<!-- tests/eversports/fixtures/calendar_week.html -->
<div><ul>
  <h3 data-day="2026-06-16">Dienstag</h3>
  <li data-uuid="uuid-yoga-18"><div class="session-time">18:00 - 19:00</div><div class="session-name">Yoga</div></li>
  <li data-uuid="uuid-crossfit-18"><div class="session-time">18:00 - 19:00</div><div class="session-name">CrossFit</div></li>
  <li data-uuid="uuid-crossfit-19"><div class="session-time">19:00 - 20:00</div><div class="session-name">CrossFit</div></li>
</ul><ul>
  <h3 data-day="2026-06-17">Mittwoch</h3>
  <li data-uuid="uuid-crossfit-mi"><div class="session-time">18:00 - 19:00</div><div class="session-name">CrossFit</div></li>
</ul></div>
```

```html
<!-- tests/eversports/fixtures/profile_bookings.html -->
<div class="marketplace-booked-activity">
  <h4 class="marketplace-booked-activity__name">CrossFit</h4>
  <div class="marketplace-booked-activity__facility"><a href="/s/crossfit-rabbit-hole">CrossFit Rabbit Hole</a></div>
  <input id="google-calendar-start" value="20260616T180000" />
  <input id="google-calendar-end" value="20260616T190000" />
  <input id="facility-street" value="Musterstr. 1" />
  <input id="facility-zip" value="10115" />
  <input id="facility-city" value="Berlin" />
  <a class="cancel-link-event" data-event="evt-1" data-eventparticipant="ep-1" data-facilityid="73041" data-session="sess-1">Stornieren</a>
</div>
```

- [ ] **Step 2: Failing Tests schreiben**

```python
# tests/eversports/test_parsing.py
from datetime import date
from pathlib import Path

import pytest

from backend.eversports.errors import MarkupDrift
from backend.eversports.parsing import (
    extract_facility_id, parse_calendar_slots, parse_upcoming_bookings,
)

FIXTURES = Path(__file__).parent / "fixtures"


def _calendar() -> str:
    return (FIXTURES / "calendar_week.html").read_text()


def test_kalender_findet_passenden_slot():
    uuids = parse_calendar_slots(_calendar(), target_date=date(2026, 6, 16),
                                 target_time="18:00", class_name="CrossFit")
    assert uuids == ["uuid-crossfit-18"]


def test_kalender_filtert_nach_name_zeit_und_datum():
    assert parse_calendar_slots(_calendar(), date(2026, 6, 16), "19:00", "CrossFit") == ["uuid-crossfit-19"]
    assert parse_calendar_slots(_calendar(), date(2026, 6, 17), "18:00", "CrossFit") == ["uuid-crossfit-mi"]
    assert parse_calendar_slots(_calendar(), date(2026, 6, 16), "18:00", "Pilates") == []


def test_profilseite_liefert_strukturierte_buchung():
    bookings = parse_upcoming_bookings((FIXTURES / "profile_bookings.html").read_text())
    assert len(bookings) == 1
    b = bookings[0]
    assert b["activity_name"] == "CrossFit"
    assert b["facility_slug"] == "crossfit-rabbit-hole"
    assert b["start_datetime"] == "2026-06-16T18:00:00"
    assert b["address"] == "Musterstr. 1, 10115 Berlin"
    assert b["event_id"] == "evt-1"
    assert b["facility_id"] == "73041"


def test_facility_id_aus_slug_seite():
    assert extract_facility_id('<div data-id="73041">x</div>', page="/scl/slug") == "73041"


def test_facility_id_fehlend_ist_markup_drift():
    with pytest.raises(MarkupDrift):
        extract_facility_id("<html><body>Cloudflare</body></html>", page="/scl/slug")
```

- [ ] **Step 3: Fehlschlag verifizieren**

Run: `venv/bin/pytest tests/eversports/test_parsing.py -v`
Expected: FAIL mit `ImportError` (parsing-Modul fehlt)

- [ ] **Step 4: Implementierung — Logik verbatim verschieben**

`parse_calendar_slots`: Schleifenkörper aus `backend/core/booking.py:209-222` (ab `soup = BeautifulSoup(...)`) als Funktion. `parse_upcoming_bookings`: Körper aus `:387-433` (`_get_input`, `_parse_dt`, Block-Schleife) unverändert. `extract_facility_id`: Regex `_DATA_ID_RE` aus `:25` plus Fehlerfall.

```python
# backend/eversports/parsing.py
"""Reine HTML-Parser für Eversports-Seiten. Kein I/O — testbar mit Fixtures.

Bei Markup-Änderungen seitens Eversports schlagen die Contract-Tests in
tests/eversports/test_parsing.py fehl bzw. wird MarkupDrift geworfen.
"""
from __future__ import annotations

import re
from datetime import date, datetime

from bs4 import BeautifulSoup

from backend.eversports.errors import MarkupDrift

_DATA_ID_RE = re.compile(r"data-id=[\"'](\d+)[\"']")


def extract_facility_id(html: str, page: str) -> str:
    match = _DATA_ID_RE.search(html)
    if not match:
        raise MarkupDrift("Numerische facility-ID (data-id) nicht gefunden", page=page)
    return match.group(1)


def parse_calendar_slots(html: str, target_date: date, target_time: str, class_name: str) -> list[str]:
    """data-uuids aller Slots am target_date, die um target_time beginnen und class_name heißen."""
    soup = BeautifulSoup(html, "html.parser")
    matches: list[str] = []
    for ul in soup.find_all("ul"):
        header = ul.find("h3", attrs={"data-day": target_date.isoformat()})
        if not header:
            continue
        for li in ul.find_all("li", attrs={"data-uuid": True}):
            time_div = li.find(class_="session-time")
            name_div = li.find(class_="session-name")
            if time_div and name_div:
                if (
                    time_div.get_text(strip=True).startswith(target_time)
                    and name_div.get_text(strip=True) == class_name
                ):
                    matches.append(li["data-uuid"])
    return matches


def _get_input(block, id_: str) -> str:
    el = block.find("input", id=id_)
    return el["value"] if el else ""


def _parse_dt(raw: str) -> str:
    try:
        return datetime.strptime(raw, "%Y%m%dT%H%M%S").isoformat()
    except ValueError:
        return raw


def parse_upcoming_bookings(html: str) -> list[dict]:
    """Strukturierte Buchungen von der /u-Profilseite."""
    soup = BeautifulSoup(html, "html.parser")
    bookings = []
    for block in soup.find_all("div", class_="marketplace-booked-activity"):
        name_el = block.find("h4", class_="marketplace-booked-activity__name")
        activity_name = name_el.get_text(strip=True) if name_el else ""

        facility_el = block.find("div", class_="marketplace-booked-activity__facility")
        facility_link = facility_el.find("a") if facility_el else None
        facility_name = facility_link.get_text(strip=True) if facility_link else ""
        facility_href = facility_link.get("href", "") if facility_link else ""
        facility_slug = facility_href.removeprefix("/s/")

        cancel_link = block.find("a", class_="cancel-link-event")
        if cancel_link is None:
            continue

        street = _get_input(block, "facility-street")
        zip_ = _get_input(block, "facility-zip")
        city = _get_input(block, "facility-city")
        parts = [p for p in [street, f"{zip_} {city}".strip()] if p]
        address = ", ".join(parts)

        bookings.append({
            "activity_name": activity_name,
            "facility_name": facility_name,
            "facility_slug": facility_slug,
            "start_datetime": _parse_dt(_get_input(block, "google-calendar-start")),
            "end_datetime": _parse_dt(_get_input(block, "google-calendar-end")),
            "address": address,
            "event_id": cancel_link.get("data-event", ""),
            "event_participant_id": cancel_link.get("data-eventparticipant", ""),
            "session_id": cancel_link.get("data-session", ""),
            "facility_id": cancel_link.get("data-facilityid", ""),
        })
    return bookings
```

- [ ] **Step 5: Erfolg verifizieren**

Run: `venv/bin/pytest tests/eversports/test_parsing.py -v`
Expected: 5 passed

- [ ] **Step 6: Commit**

```bash
git add backend/eversports/parsing.py tests/eversports/
git commit -m "feat(eversports): reine HTML-Parser mit Contract-Fixtures"
```

---

### Task 4: client.py — HTTP/GraphQL-Flows verschieben

**Files:**
- Create: `backend/eversports/client.py`
- Test: `tests/eversports/test_client.py`
- Quelle: `backend/core/booking.py` — `_SESSION_HEADERS`/URLs/`TIMEOUT` (`:22-46`), `_gql` (`:48-60`), `_resolve_facility_id` (`:63-78`), `join_waitlist` (`:80-101`), `eversports_login` (`:104-150`), `book_session` (`:153-291`), `cancel_booking`/`_cancel_with_session` (`:293-369`), `fetch_upcoming_bookings` (`:372-432`), `cancel_booking_by_ids` (`:435-465`)

- [ ] **Step 1: Failing Test schreiben (Kernverhalten über gemocktes HTTP)**

```python
# tests/eversports/test_client.py
from datetime import date
from unittest.mock import MagicMock, patch

import pytest

from backend.core.status import BookingStatus
from backend.eversports.client import book_session, eversports_login
from backend.eversports.errors import AuthFailed


def _gql_response(payload: dict) -> MagicMock:
    resp = MagicMock(ok=True)
    resp.json.return_value = {"data": payload}
    return resp


def test_login_fehlschlag_liefert_none():
    session = MagicMock()
    session.post.return_value = _gql_response(
        {"credentialLogin": {"__typename": "ExpectedErrors", "errors": []}}
    )
    with patch("backend.eversports.client.requests.Session", return_value=session):
        assert eversports_login("a@b.com", "falsch") is None


def test_book_session_klassifiziert_ausgebucht_als_waitlist():
    session = MagicMock()
    calendar_resp = MagicMock(ok=True)
    calendar_resp.json.return_value = {"data": {"html": (
        '<ul><h3 data-day="2026-06-16"></h3>'
        '<li data-uuid="u1"><div class="session-time">18:00</div>'
        '<div class="session-name">CrossFit</div></li></ul>'
    )}}
    session.get.return_value = calendar_resp
    session.post.side_effect = [
        _gql_response({"credentialLogin": {"__typename": "AuthResult", "apiToken": "t",
                                           "user": {"id": "ev-1", "profilePicture": None}}}),
        _gql_response({"createCartFromEventBookableItem": {
            "__typename": "ExpectedErrors", "errors": [{"message": "Diese Klasse ist ausgebucht"}]}}),
        _gql_response({"addToWaitingList": {"__typename": "WaitingList", "id": "u1"}}),
    ]
    with patch("backend.eversports.client.requests.Session", return_value=session):
        result = book_session(email="a@b.com", password="pw", target_date=date(2026, 6, 16),
                              target_time="18:00", facility_id="73041", class_name="CrossFit",
                              event_type="class")
    assert result["status"] == BookingStatus.WAITLIST
```

- [ ] **Step 2: Fehlschlag verifizieren**

Run: `venv/bin/pytest tests/eversports/test_client.py -v`
Expected: FAIL mit `ImportError` (client-Modul fehlt)

- [ ] **Step 3: Implementierung — Funktionen verbatim aus booking.py verschieben, drei gezielte Ersetzungen**

Alle oben gelisteten Funktionen unverändert nach `backend/eversports/client.py` kopieren (inkl. Modul-Docstring, Konstanten, GraphQL-Queries). Dann genau diese Ersetzungen:

1. **Kalender-Parsing** (im `book_session`, Original `:208-225`): den `soup`-Block ersetzen durch
   ```python
   matches = parse_calendar_slots(calendar_html, target_date, target_time, class_name)
   if matches:
       matched_event_type = et
       break
   ```
2. **Cart-Fehler-Klassifikation** (Original `:255-267`): ersetzen durch
   ```python
   if cart_result["__typename"] == "ExpectedErrors":
       messages = [e["message"] for e in cart_result["errors"]]
       outcome = classify_cart_errors(messages)
       if outcome is CartOutcome.ALREADY_BOOKED:
           return {"status": BookingStatus.ALREADY_BOOKED, "order_id": None, "event_type": matched_event_type, "_session": session}
       if outcome is CartOutcome.SLOT_FULL:
           join_waitlist(session, bookable_item_id)
           return {"status": BookingStatus.WAITLIST, "order_id": None, "event_type": matched_event_type, "_session": session}
       raise PlatformError(f"Cart creation failed: {'; '.join(messages)}")
   ```
3. **`_resolve_facility_id`** (Original `:63-78`): HTML-Teil ersetzen durch `return extract_facility_id(resp.text, page="/scl/" + facility_id)`.
4. **`fetch_upcoming_bookings` und `_cancel_with_session`**: /u-Parsing durch `parse_upcoming_bookings(resp.text)` ersetzen; `_cancel_with_session` filtert das Ergebnis von `parse_upcoming_bookings` statt selbst zu parsen (Felder `facility_id`, `activity_name`, `start_datetime` stehen im Dict).
5. **Fehlerklassen**: `raise RuntimeError("Eversports login failed")` → `raise AuthFailed("Eversports login failed")`; `raise RuntimeError(f"{class_name} ... not found ...")` → `SlotNotFound(...)`; `_http_error` gibt `PlatformError` zurück; GraphQL-`errors` in `_gql` → `PlatformError`.

Imports am Modulkopf:

```python
from backend.core.status import BookingStatus
from backend.eversports.classify import CartOutcome, classify_cart_errors
from backend.eversports.errors import AuthFailed, MarkupDrift, PlatformError, SlotNotFound
from backend.eversports.parsing import extract_facility_id, parse_calendar_slots, parse_upcoming_bookings
```

- [ ] **Step 4: Erfolg verifizieren**

Run: `venv/bin/pytest tests/eversports/ -v`
Expected: alle Tests passed

- [ ] **Step 5: Public API in `__init__.py`**

```python
# backend/eversports/__init__.py
from backend.eversports.client import (
    book_session, cancel_booking, cancel_booking_by_ids,
    eversports_login, fetch_upcoming_bookings, join_waitlist,
    _cancel_with_session, _resolve_facility_id,
)
from backend.eversports.errors import (
    AuthFailed, EversportsError, MarkupDrift, PlatformError, SlotNotFound,
)
```

- [ ] **Step 6: Commit**

```bash
git add backend/eversports/ tests/eversports/
git commit -m "feat(eversports): Client-Flows ins Paket verschoben, typisierte Fehler"
```

---

### Task 5: booking.py wird Shim — Gesamtsuite muss grün bleiben

**Files:**
- Modify: `backend/core/booking.py` (kompletter Inhalt ersetzen)

- [ ] **Step 1: Shim schreiben**

```python
# backend/core/booking.py
"""DEPRECATED Shim — Code lebt in backend/eversports/. Wird nach Caller-Migration gelöscht."""
from backend.eversports import (  # noqa: F401
    AuthFailed, EversportsError, MarkupDrift, PlatformError, SlotNotFound,
    _cancel_with_session, _resolve_facility_id, book_session, cancel_booking,
    cancel_booking_by_ids, eversports_login, fetch_upcoming_bookings, join_waitlist,
)
```

- [ ] **Step 2: Gesamtsuite ausführen**

Run: `venv/bin/pytest tests/ -q`
Expected: alle bestehenden Tests passed (Aufrufer importieren noch aus `backend.core.booking`, bekommen aber den Paket-Code). Schlagen Tests fehl, die `backend.core.booking.X` patchen: Patch-Target auf `backend.eversports.client.X` NICHT umstellen — die Aufrufer-Module patchen weiterhin ihr eigenes importiertes Symbol (`worker.worker.book_session` etc.), das funktioniert unverändert.

- [ ] **Step 3: Commit**

```bash
git add backend/core/booking.py
git commit -m "refactor(eversports): booking.py zum Re-Export-Shim reduziert"
```

---

### Task 6: Aufrufer umstellen

**Files (jeweils nur Import-Zeile ändern):**
- Modify: `worker/worker.py:23` → `from backend.eversports import book_session, cancel_booking, fetch_upcoming_bookings`
- Modify: `backend/api/auth.py:12` → `from backend.eversports import eversports_login`
- Modify: `backend/api/jobs.py:13` → `from backend.eversports import book_session, _cancel_with_session, eversports_login`
- Modify: `backend/api/facilities.py:24` → `from backend.eversports import eversports_login, _resolve_facility_id as _booking_resolve_facility_id`
- Modify: `backend/api/bookings.py:7` → `from backend.eversports import fetch_upcoming_bookings, cancel_booking_by_ids`
- Modify: `backend/api/calendar.py:12` → `from backend.eversports import fetch_upcoming_bookings`

- [ ] **Step 1: Alle sechs Imports ändern** (Zeilennummern können leicht abweichen — per `grep -rn "from backend.core.booking import" backend worker` finden)

- [ ] **Step 2: Gesamtsuite ausführen**

Run: `venv/bin/pytest tests/ -q`
Expected: alle Tests passed. Patch-Targets in Tests (z.B. `mocker.patch("backend.api.auth.eversports_login")`) funktionieren unverändert, weil sie das Symbol im Aufrufer-Modul patchen.

- [ ] **Step 3: Commit**

```bash
git add worker/worker.py backend/api/
git commit -m "refactor(eversports): Aufrufer auf das Paket umgestellt"
```

---

### Task 7: Shim löschen

**Files:**
- Delete: `backend/core/booking.py`
- Prüfen: `grep -rn "core.booking\|core import booking" backend worker tests` muss leer sein (Tests, die noch `backend.core.booking` referenzieren, auf `backend.eversports` umstellen — z.B. `tests/backend/test_booking_waitlist.py`, `tests/backend/test_get_facility_courses.py`)

- [ ] **Step 1: Verbliebene Referenzen finden und umstellen**

Run: `grep -rn "core.booking" backend worker tests`
Jede Fundstelle: Import auf `backend.eversports` bzw. Patch-Target auf das importierende Modul ändern.

- [ ] **Step 2: Datei löschen, Gesamtsuite ausführen**

Run: `rm backend/core/booking.py && venv/bin/pytest tests/ -q`
Expected: alle Tests passed

- [ ] **Step 3: CLAUDE.md-Invarianten ergänzen**

Im Abschnitt „Architektur-Invarianten" ergänzen:

```markdown
### Eversports-Zugriff

* `backend/eversports/` ist der **einzige** Code, der die Eversports-Plattform berührt. Neue Plattform-Interaktionen gehören dorthin, nie in API-Handler oder den Worker.
* Fehlertext-Klassifikation (lokalisierte Strings) ausschließlich in `backend/eversports/classify.py` — Keyword-Änderungen immer mit Test.
* HTML-Parsing ausschließlich in `backend/eversports/parsing.py` (reine Funktionen, Contract-Fixtures in `tests/eversports/fixtures/`). `MarkupDrift` heißt: Eversports hat das Markup geändert.
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor(eversports): booking.py-Shim entfernt, Invarianten dokumentiert"
```

---

## Self-Review-Notizen

- Verhalten von `classify_cart_errors` ist bewusst 1:1 (inkl. already-vor-full-Priorität) — kein „Verbessern" der Keywords in diesem Plan.
- `_session`-Schlüssel im `book_session`-Rückgabe-Dict bleibt erhalten (wird von `backend/api/jobs.py` Debug-Cancel-Pfad genutzt); typisierte Dataclass-Rückgaben sind bewusst NICHT Teil dieses Plans (YAGNI — erst wenn ein zweiter Konsument es braucht).
- `EversportsError(RuntimeError)` hält alle bestehenden `except RuntimeError`/`except Exception`-Handler funktionsfähig.
