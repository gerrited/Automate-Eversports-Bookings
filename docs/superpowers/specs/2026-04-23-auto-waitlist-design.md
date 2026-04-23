# Auto-Warteliste bei vollständig gebuchten Kursen

**Datum:** 2026-04-23  
**Status:** Genehmigt

## Zusammenfassung

Wenn ein Buchungsauftrag scheitert, weil der Kurs bereits vollständig gebucht ist, soll der Worker den Benutzer automatisch auf die Warteliste des Kurses eintragen. Eversports benachrichtigt den Benutzer selbst, wenn ein Platz frei wird. Der Worker protokolliert die Wartelisten-Anmeldung im Log und sendet eine Benachrichtigungs-E-Mail.

## Kontext

### Bestehender Buchungsablauf

1. `book_session()` in `backend/core/booking.py` loggt ein, sucht den Kurs im Kalender und erhält die `bookableItemId` (UUID).
2. `createCartFromEventBookableItem` wird aufgerufen. Bei einem vollen Kurs liefert die API `ExpectedErrors` mit einer Fehlermeldung (z.B. „ausgebucht", „sold out").
3. Aktuell führt das zu einem `RuntimeError`, der Worker loggt `"failed"` und sendet eine Fehler-E-Mail.

### Eversports Wartelisten-API (verifiziert)

Beide Mutations wurden erfolgreich getestet gegen `https://www.eversports.de/api/checkout`:

```graphql
mutation AddToWaitingList($eventBookableItemId: ID!) {
  addToWaitingList(eventBookableItemId: $eventBookableItemId) {
    ... on WaitingList { id __typename }
    ... on ExpectedErrors { errors { message __typename } __typename }
    __typename
  }
}

mutation RemoveFromWaitingList($eventBookableItemId: ID!) {
  removeFromWaitingList(eventBookableItemId: $eventBookableItemId) {
    ... on WaitingList { id __typename }
    ... on ExpectedErrors { errors { message __typename } __typename }
    __typename
  }
}
```

Der Response-`id` ist identisch mit der `eventBookableItemId`. Die Warteliste ist nur in der Eversports-App sichtbar, nicht im Web-Frontend — die API selbst funktioniert aber für beide Clients.

## Design

### Architektur

```
worker.py
  └─ process_job()
       └─ book_session()                   ← booking.py
            ├─ createCartFromEventBookableItem
            │    └─ ExpectedErrors mit FULLY_BOOKED-Meldung
            │         └─ join_waitlist()   ← neu in booking.py
            │              └─ addToWaitingList(eventBookableItemId)
            └─ return {"status": "waitlist", ...}
  └─ Status "waitlist" erkannt
       ├─ BookingLog status="waitlist" speichern
       └─ send_waitlist_notification()     ← neu in worker/email.py
```

### Änderungen im Detail

#### `backend/core/booking.py`

**Neue Funktion `join_waitlist(session, event_bookable_item_id)`:**
- Sendet `addToWaitingList`-Mutation mit `eventBookableItemId`
- Gibt die WaitingList-ID zurück bei Erfolg
- Wirft `RuntimeError` bei `ExpectedErrors`

**Änderung in `book_session()` — Cart-Fehlerbehandlung:**

Bestehende FULLY_BOOKED-Erkennung erweitern. Nach dem `already`/`bereits`-Check:
```python
full_keywords = ("fully booked", "ausgebucht", "sold out", "no spots", "fully_booked")
if any(kw in msg for kw in full_keywords):
    join_waitlist(session, bookable_item_id)
    return {"status": "waitlist", "order_id": None, "event_type": matched_event_type}
```

Schlägt `join_waitlist()` selbst fehl, propagiert der `RuntimeError` nach oben → Worker behandelt es als normalen Fehler.

#### `worker/worker.py`

In `process_job()`, Status-Behandlung nach `book_session()`:

- `"success"` → wie bisher
- `"already_booked"` → wie bisher  
- `"waitlist"` → neu: Log-Status `"waitlist"`, `send_waitlist_notification()` aufrufen, kein Fehler-Mail

#### `worker/email.py`

Neue Funktion `send_waitlist_notification(job, target_date, class_name, time_str, weekday_str, date_str)` mit gleichem Muster wie `send_failure_email()`.

#### `worker/templates/email/booking_waitlist.html`

Template-Variablen: `class_name`, `time_str`, `weekday_str`, `date_str`, `facility_name`, `frontend_url`

Inhalt: Bestätigung der Wartelisten-Anmeldung mit Hinweis, dass Eversports direkt benachrichtigt, wenn ein Platz frei wird.

#### Frontend — Job-History-Ansicht

Status `"waitlist"` erhält ein eigenes Badge (analog zu `"already_booked"`). Farbe: gelb/orange. Label: „Warteliste".

### Neuer `BookingLog`-Status

`"waitlist"` ergänzt die bestehenden Stati `"success"`, `"failed"`, `"already_booked"`. Kein Schema-Change nötig (String-Feld).

## Fehlerbehandlung

| Szenario | Verhalten |
|---|---|
| `join_waitlist()` schlägt fehl (ExpectedErrors) | RuntimeError → Worker loggt `"failed"`, Fehler-Mail |
| Kurs ist voll, aber Warteliste deaktiviert | ExpectedErrors von API → `"failed"` |
| Nutzer bereits auf Warteliste | ExpectedErrors von API → `"failed"` mit entsprechender Meldung |

## Nicht im Scope

- Pro-Job-Konfiguration (Warteliste immer aktiv)
- Automatisches Nachbuchen wenn Platz frei (würde Webhook von Eversports erfordern)
- Admin-Benachrichtigung bei Wartelisten-Anmeldung

## Testscript

`test_waitlist.py` im Projektwurzel dient zur manuellen Verifikation der Mutations und kann nach Abschluss der Implementierung gelöscht werden.
