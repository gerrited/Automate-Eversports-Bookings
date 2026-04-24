# Design: Limit aktiver Buchungen pro Benutzer

**Datum:** 2026-04-24

## Zusammenfassung

Das `users`-Modell erhält ein neues Feld `max_active_jobs` (nullable Integer). Beim Erstellen und beim Aktivieren eines `BookingJob` wird geprüft, ob der Benutzer sein Limit bereits erreicht hat. Überschreitungen werden mit HTTP 409 abgelehnt.

---

## Datenbankschema

**Tabelle:** `users`  
**Neues Feld:** `max_active_jobs` (Integer, nullable, kein Default)

- `NULL` = unbegrenzt (Standardverhalten für alle bestehenden und neuen Benutzer)
- Positive Ganzzahl = maximale Anzahl gleichzeitig aktiver (`enabled=true`) Buchungen
- Wird nur direkt in der Datenbank gesetzt (kein API-Endpunkt)

**Migration:** `add_max_active_jobs_to_users` — fügt Spalte mit `nullable=True` hinzu, kein Backfill.

---

## Prüflogik

**Neue Hilfsfunktion** `_check_job_limit(user, db)` in `backend/api/jobs.py`:

1. Wenn `user.max_active_jobs` ist `None` → nichts tun (unbegrenzt)
2. Aktive Jobs zählen: `SELECT COUNT(*) FROM booking_jobs WHERE user_id = user.id AND enabled = true`
3. Wenn Anzahl `>= user.max_active_jobs` → `HTTPException(status_code=409, detail="Limit von {n} aktiven Buchungen erreicht.")`

---

## Betroffene Endpunkte

| Endpunkt | Bedingung | Aktion |
|---|---|---|
| `POST /jobs` | Immer (neue Jobs sind `enabled=True`) | `_check_job_limit` vor Insert aufrufen |
| `PATCH /jobs/{id}/toggle` | Nur wenn `job.enabled == False` (Toggle → aktiv) | `_check_job_limit` vor Toggle aufrufen |
| `PUT /jobs/{id}` | Nie (`enabled` ist kein Feld in `JobUpdate`) | Keine Änderung |

---

## Was nicht geändert wird

- Kein API-Endpunkt zum Lesen oder Setzen von `max_active_jobs`
- Keine Frontend-Änderungen
- Bestehende Jobs bleiben unberührt, auch wenn sie ein nachträglich gesetztes Limit überschreiten
