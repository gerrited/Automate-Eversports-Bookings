# Worker Aktiv-Benutzer-Filter — Design Spec

**Datum:** 2026-04-12  
**Status:** Genehmigt

## Übersicht

Der Buchungs-Worker soll nur Buchungen verarbeiten, die zu aktiven Benutzern gehören. Inaktive Benutzer (jene, die auf Admin-Freischaltung warten) müssen stillschweigend übersprungen werden — ihre Buchungen sollen keine Ausführungen auslösen.

---

## Änderung

**Datei:** `worker/worker.py` — Funktion `run()`

Die Einstiegsabfrage wird um einen `JOIN` auf `User` und einen zusätzlichen Filter auf `User.active` erweitert. Keine weiteren Produktionscode-Änderungen erforderlich.

**Vorher:**
```python
jobs = db.query(BookingJob).filter(BookingJob.enabled.is_(True)).all()
```

**Nachher:**
```python
jobs = (
    db.query(BookingJob)
    .join(User, BookingJob.user_id == User.id)
    .filter(BookingJob.enabled.is_(True), User.active.is_(True))
    .all()
)
```

Der Benutzer-Fetch pro Buchung (zum Entschlüsseln des Passworts) bleibt unverändert.

---

## Tests

`tests/worker/test_worker.py` erhält einen neuen Testfall:

- Eine Buchung, die zu einem inaktiven Benutzer (`active=False`) gehört, darf nicht verarbeitet werden, auch wenn die Buchung aktiv und fällig ist.

---

## Nicht im Scope

- Logging einer Warnung beim Überspringen von Buchungen inaktiver Benutzer (sie treten nie in die Schleife ein).
- Frontend- oder API-Änderungen.
