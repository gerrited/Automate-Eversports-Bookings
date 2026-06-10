# Session-Cache für Eversports-Logins — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Jede Operation (Buchung, Push-Check, Kalender-Feed, Storno) loggt sich heute komplett neu bei Eversports ein. Ein TTL-Cache pro Nutzer reduziert das auf einen Login pro ~20 Minuten — weniger Latenz, deutlich geringeres Risiko, dass Eversports die Server-IP als auffällig einstuft.

**Architecture:** `backend/eversports/session_cache.py` cached das komplette Login-Ergebnis (`{"user_id", "session", "avatar_url"}`) keyed auf SHA-256 von `email:password` (Passwort-Wechsel = neuer Key = automatisch frischer Login). Wiederverwendet `TTLCache` aus `backend/core/cache.py`. Operationen, die mit gecachter Session fehlschlagen, invalidieren den Eintrag und versuchen es genau einmal mit frischem Login (Retry-Wrapper im Client).

**Tech Stack:** Python stdlib (`hashlib`), bestehender `TTLCache`. Keine neuen Abhängigkeiten.

**Voraussetzung:** Plan `2026-06-10-eversports-client-paket.md` ist umgesetzt (Modul-Pfade beziehen sich auf `backend/eversports/`). Falls nicht: identische Logik in `backend/core/booking.py` einbauen, Pfade entsprechend.

**Bewusste Einschränkungen:**
- Cache ist pro Prozess (Backend-Pod bzw. Worker-Lauf). Der Worker profitiert innerhalb eines Laufs (z.B. Push-Checks + Buchung desselben Nutzers); über Läufe hinweg nicht — das ist okay, ein CronJob-Lauf alle 15 Min ist genau ein Login pro aktivem Nutzer.
- `requests.Session` ist nicht strikt threadsicher. Innerhalb des Workers verarbeitet aber pro Nutzer höchstens ein Thread gleichzeitig eine Buchung; Push-Checks laufen sequentiell nach dem Pool. Restrisiko dokumentieren, nicht überbauen.

---

## File Structure

| Datei | Verantwortung |
|---|---|
| `backend/eversports/session_cache.py` | `get_or_login()`, `invalidate()` — einzige Stelle mit Login-Caching |
| `backend/eversports/client.py` | nutzt `get_or_login()` statt `eversports_login()` in `book_session`, `cancel_booking`, `fetch_upcoming_bookings`, `cancel_booking_by_ids` |
| `tests/eversports/test_session_cache.py` | Unit-Tests Cache-Verhalten |
| `tests/backend/conftest.py` | Cache-Reset pro Test (wie `login_limiter`) |

---

### Task 1: SessionCache-Modul

**Files:**
- Create: `backend/eversports/session_cache.py`
- Test: `tests/eversports/test_session_cache.py`

- [ ] **Step 1: Failing Tests schreiben**

```python
# tests/eversports/test_session_cache.py
from unittest.mock import MagicMock, patch

import pytest

from backend.eversports import session_cache
from backend.eversports.session_cache import get_or_login, invalidate


@pytest.fixture(autouse=True)
def _clear_cache():
    session_cache._cache.clear()
    yield
    session_cache._cache.clear()


def _login_result(uid="ev-1"):
    return {"user_id": uid, "session": MagicMock(), "avatar_url": None}


def test_zweiter_aufruf_loggt_nicht_erneut_ein():
    with patch("backend.eversports.session_cache.eversports_login",
               return_value=_login_result()) as mock_login:
        first = get_or_login("a@b.com", "pw")
        second = get_or_login("a@b.com", "pw")
    assert mock_login.call_count == 1
    assert first is second


def test_anderes_passwort_ist_anderer_cache_key():
    with patch("backend.eversports.session_cache.eversports_login",
               side_effect=[_login_result("ev-1"), _login_result("ev-2")]) as mock_login:
        get_or_login("a@b.com", "altes-pw")
        get_or_login("a@b.com", "neues-pw")
    assert mock_login.call_count == 2


def test_fehlgeschlagener_login_wird_nicht_gecacht():
    with patch("backend.eversports.session_cache.eversports_login",
               side_effect=[None, _login_result()]) as mock_login:
        assert get_or_login("a@b.com", "pw") is None
        assert get_or_login("a@b.com", "pw") is not None
    assert mock_login.call_count == 2


def test_invalidate_erzwingt_frischen_login():
    with patch("backend.eversports.session_cache.eversports_login",
               return_value=_login_result()) as mock_login:
        get_or_login("a@b.com", "pw")
        invalidate("a@b.com", "pw")
        get_or_login("a@b.com", "pw")
    assert mock_login.call_count == 2
```

- [ ] **Step 2: Fehlschlag verifizieren**

Run: `venv/bin/pytest tests/eversports/test_session_cache.py -v`
Expected: FAIL mit `ImportError: cannot import name 'session_cache'`

- [ ] **Step 3: Implementierung**

```python
# backend/eversports/session_cache.py
"""Login-Cache: ein Eversports-Login pro Nutzer und TTL statt pro Operation.

Key = SHA-256(email:password) — ein Passwortwechsel ergibt automatisch einen
neuen Key und damit einen frischen Login. Es werden nie Klartext-Credentials
im Cache abgelegt, nur der Hash als Schlüssel und das Login-Ergebnis als Wert.
"""
import hashlib

from backend.core.cache import TTLCache
from backend.eversports.client import eversports_login

# 20 Min: deutlich länger als ein Worker-Lauf, kurz genug, dass server-
# seitig ablaufende Sessions selten auftreten (Retry-Wrapper fängt den Rest)
_cache = TTLCache(ttl_seconds=20 * 60)


def _key(email: str, password: str) -> str:
    return hashlib.sha256(f"{email}:{password}".encode()).hexdigest()


def get_or_login(email: str, password: str) -> dict | None:
    """Gecachtes Login-Ergebnis oder frischer Login. None bei Auth-Fehlschlag (nie gecacht)."""
    key = _key(email, password)
    cached = _cache.get(key)
    if cached is not None:
        return cached
    result = eversports_login(email, password)
    if result is not None:
        _cache.set(key, result)
    return result


def invalidate(email: str, password: str) -> None:
    _cache.set(_key(email, password), None)  # TTLCache.get behandelt None wie Miss
```

**Achtung Implementierungsdetail:** `TTLCache.get` gibt bei gespeichertem `None` ebenfalls `None` zurück und `get_or_login` behandelt das als Miss — `invalidate` über `set(key, None)` funktioniert deshalb. Wer das unsauber findet: `TTLCache` um `delete(key)` erweitern (3 Zeilen + Test in `tests/backend/test_cache.py`).

- [ ] **Step 4: Erfolg verifizieren**

Run: `venv/bin/pytest tests/eversports/test_session_cache.py -v`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add backend/eversports/session_cache.py tests/eversports/test_session_cache.py
git commit -m "feat(eversports): Login-Cache mit TTL pro Nutzer"
```

---

### Task 2: Retry-Wrapper im Client

Server-seitig abgelaufene Sessions äußern sich als fehlgeschlagene Folge-Requests (`PlatformError`, leere Parsing-Ergebnisse mit Login-Redirect). Strategie: Operation mit gecachter Session versuchen; bei `EversportsError` invalidieren und genau einmal mit frischem Login wiederholen.

**Files:**
- Modify: `backend/eversports/client.py`
- Test: `tests/eversports/test_client.py` (ergänzen)

- [ ] **Step 1: Failing Test schreiben**

```python
# tests/eversports/test_client.py — ergänzen
from backend.eversports.client import _with_login_retry
from backend.eversports.errors import PlatformError


def test_with_login_retry_wiederholt_einmal_mit_frischem_login():
    calls = []

    def op(login):
        calls.append(login["user_id"])
        if len(calls) == 1:
            raise PlatformError("HTTP 403 from Eversports")
        return "ok"

    fresh = {"user_id": "ev-frisch", "session": MagicMock(), "avatar_url": None}
    stale = {"user_id": "ev-alt", "session": MagicMock(), "avatar_url": None}
    with patch("backend.eversports.client.session_cache.get_or_login", side_effect=[stale, fresh]), \
         patch("backend.eversports.client.session_cache.invalidate") as mock_inv:
        assert _with_login_retry("a@b.com", "pw", op) == "ok"
    mock_inv.assert_called_once_with("a@b.com", "pw")
    assert calls == ["ev-alt", "ev-frisch"]


def test_with_login_retry_gibt_zweiten_fehler_weiter():
    def op(login):
        raise PlatformError("dauerhaft kaputt")

    fresh = {"user_id": "ev-1", "session": MagicMock(), "avatar_url": None}
    with patch("backend.eversports.client.session_cache.get_or_login", return_value=fresh), \
         patch("backend.eversports.client.session_cache.invalidate"):
        with pytest.raises(PlatformError):
            _with_login_retry("a@b.com", "pw", op)
```

- [ ] **Step 2: Fehlschlag verifizieren**

Run: `venv/bin/pytest tests/eversports/test_client.py -v`
Expected: FAIL mit `ImportError: cannot import name '_with_login_retry'`

- [ ] **Step 3: Implementierung in client.py**

Import-Zyklus vermeiden: `session_cache` importiert aus `client` (`eversports_login`), daher importiert `client` das Cache-Modul **lazy in der Funktion**:

```python
# backend/eversports/client.py — ergänzen
def _with_login_retry(email: str, password: str, operation):
    """Führt operation(login_result) aus; bei EversportsError einmal mit frischem Login wiederholen."""
    from backend.eversports import session_cache  # lazy: vermeidet Import-Zyklus

    login = session_cache.get_or_login(email, password)
    if login is None:
        raise AuthFailed("Eversports login failed")
    try:
        return operation(login)
    except AuthFailed:
        raise
    except EversportsError:
        session_cache.invalidate(email, password)
        login = session_cache.get_or_login(email, password)
        if login is None:
            raise AuthFailed("Eversports login failed")
        return operation(login)
```

(`EversportsError`-Import existiert bereits aus Task 4 des Client-Paket-Plans; sonst ergänzen.)

- [ ] **Step 4: Erfolg verifizieren, Commit**

Run: `venv/bin/pytest tests/eversports/ -v` — Expected: alle passed

```bash
git add backend/eversports/client.py tests/eversports/test_client.py
git commit -m "feat(eversports): Login-Retry-Wrapper für abgelaufene Sessions"
```

---

### Task 3: Operationen auf den Cache umstellen

**Files:**
- Modify: `backend/eversports/client.py` — `book_session`, `cancel_booking`, `fetch_upcoming_bookings`, `cancel_booking_by_ids`

- [ ] **Step 1: Failing Test schreiben (Buchung + Push-Check desselben Nutzers = 1 Login)**

```python
# tests/eversports/test_session_cache.py — ergänzen
def test_book_und_fetch_teilen_sich_einen_login():
    from datetime import date
    from backend.eversports.client import book_session, fetch_upcoming_bookings

    login = _login_result()
    login["session"].get.return_value = MagicMock(ok=True, text="<html></html>")
    # book_session schlägt fehl (SlotNotFound), aber der Login ist danach gecacht
    with patch("backend.eversports.session_cache.eversports_login", return_value=login) as mock_login:
        try:
            book_session(email="a@b.com", password="pw", target_date=date(2026, 6, 16),
                         target_time="18:00", facility_id="73041", class_name="X", event_type="class")
        except Exception:
            pass
        fetch_upcoming_bookings("a@b.com", "pw")
    assert mock_login.call_count == 1
```

- [ ] **Step 2: Fehlschlag verifizieren**

Run: `venv/bin/pytest tests/eversports/test_session_cache.py -v`
Expected: neuer Test FAIL (`call_count == 2`)

- [ ] **Step 3: Umstellung**

In jeder der vier Funktionen den Kopf

```python
login_result = eversports_login(email, password)
if login_result is None:
    raise AuthFailed("Eversports login failed")   # bzw. `return []` in fetch_upcoming_bookings
session = login_result["session"]
<restliche Logik mit session>
```

ersetzen durch das Muster:

```python
def book_session(email, password, target_date, target_time, facility_id, class_name, event_type=None):
    def _op(login):
        session = login["session"]
        return _book_with_session(session, target_date=target_date, target_time=target_time,
                                  facility_id=facility_id, class_name=class_name, event_type=event_type)
    return _with_login_retry(email, password, _op)
```

Dazu die bestehende Logik jeder Funktion in eine `_<name>_with_session(session, ...)`-Funktion ausschneiden (reiner Move, keine Logikänderung). `fetch_upcoming_bookings` behält sein bisheriges Verhalten „leere Liste statt Exception": dort `_with_login_retry` in `try/except EversportsError: return []` wickeln.

**Achtung:** `SlotNotFound` (Kurs nicht im Kalender) darf KEINEN Retry auslösen — das ist kein Session-Problem. In `_with_login_retry` aus Task 2 wird deshalb ergänzt:

```python
    except (AuthFailed, SlotNotFound):
        raise
```

(Test dafür: `op` wirft `SlotNotFound`, `invalidate` darf nicht aufgerufen werden.)

- [ ] **Step 4: Gesamtsuite ausführen**

Run: `venv/bin/pytest tests/ -q`
Expected: alle Tests passed. Worker-/API-Tests mocken `book_session` etc. auf Aufrufer-Ebene und sind unberührt.

- [ ] **Step 5: Test-Isolation absichern**

In `tests/backend/conftest.py` im `client`-Fixture ergänzen (neben `login_limiter.reset()`):

```python
from backend.eversports import session_cache
session_cache._cache.clear()
```

- [ ] **Step 6: Commit**

```bash
git add backend/eversports/client.py tests/
git commit -m "feat(eversports): Buchung, Storno, Kalender und Push teilen gecachte Logins"
```

---

## Self-Review-Notizen

- `POST /api/auth/login` (Credential-Validierung beim Nutzer-Login) nutzt den Cache bewusst NICHT — dort ist der frische Login der Zweck des Aufrufs.
- Klartext-Passwörter landen nie im Cache (nur SHA-256-Key); die `requests.Session` enthält Eversports-Cookies — gleiche Sensitivität wie bisheriger Prozess-Speicher.
- TTL 20 Min < Kalender-Feed-Cache-TTL (15 Min) spielt zusammen: Feed-Abrufe treffen meist den Feed-Cache, bevor sie überhaupt einen Login brauchen.
