# Design: Admin „Jetzt buchen"-Button

**Datum:** 2026-04-23  
**Status:** Genehmigt

## Zusammenfassung

Admins sollen auf ihren eigenen Buchungskarten einen „Jetzt buchen"-Button sehen, mit dem sie die Buchung sofort für den nächsten passenden Termin (richtiger Wochentag ab heute) auslösen können, ohne auf den nächsten CronJob-Lauf warten zu müssen.

## Anforderungen

- Button erscheint nur für Admins, nur auf eigenen Jobs (Tab „Buchungen")
- Buchungsdatum: nächster Wochentag ab heute, der zu `job.weekday` passt (heute eingeschlossen, falls Wochentag stimmt)
- Synchrone Ausführung: Frontend wartet, zeigt Spinner, dann direktes Feedback
- Ergebnis wird als `BookingLog`-Eintrag gespeichert (wie beim regulären Worker-Lauf)
- Debug-Flag des Jobs wird respektiert (Test-Buchungen werden direkt wieder storniert)

## Backend

### Neuer Endpoint

```
POST /api/jobs/{job_id}/execute
```

**Authentifizierung:** Eingeloggter aktiver User (kein expliziter Admin-Check nötig — Button ist im Frontend nur für Admins sichtbar; Ownership-Check reicht).

**Logik:**

1. Job per `_get_owned_job` laden (404 wenn nicht gefunden, 403 wenn nicht Besitzer)
2. Nächstes passendes Datum berechnen:
   ```python
   today = date.today()
   days_ahead = (job.weekday - today.weekday()) % 7
   target_date = today + timedelta(days=days_ahead)
   ```
   Wenn `days_ahead == 0`, wird heute selbst verwendet (der Job ist für heute).
3. `book_session(email, password, target_date, ...)` aufrufen
4. `BookingLog`-Eintrag schreiben (Status `success`, `already_booked` oder `failed`)
5. Bei `job.debug == True` und Status `success`: Buchung direkt wieder stornieren (wie im Worker)
6. Antwort:
   ```json
   {"status": "success"|"already_booked"|"failed", "message": "..."}
   ```
   Immer HTTP 200 — auch bei Fehler. Das Frontend zeigt die Meldung direkt an.

**Datei:** `backend/api/jobs.py`

### Hilfsfunktion

```python
def _next_weekday(weekday: int) -> date:
    today = date.today()
    days_ahead = (weekday - today.weekday()) % 7
    return today + timedelta(days=days_ahead)
```

## Frontend

### API-Client

Neue Funktion in `frontend/src/api/jobs.ts`:

```typescript
export const executeJob = (id: string): Promise<{ status: string; message?: string }> =>
  apiFetch(`/api/jobs/${id}/execute`, { method: 'POST' })
```

### JobCard

**Neues Prop:**
```typescript
onExecute?: (id: string) => Promise<{ status: string; message?: string }>
```

**Lokaler State in `JobCard`:**
- `executing: boolean` — deaktiviert alle Buttons während der Request läuft
- `feedback: { status: string; message?: string } | null` — verschwindet nach 4 Sekunden

**Button:** Erscheint in der Action-Bar zwischen „Bearbeiten" und „Löschen", aber nur wenn `onExecute` übergeben wurde.

**Zustände des Buttons:**
- Normal: „Jetzt buchen" (blau)
- Laden: „Bucht…" mit Spinner, disabled; alle anderen Buttons ebenfalls disabled
- Nach Ergebnis: Feedback-Zeile unter der Action-Bar für 4 Sekunden

**Feedback-Texte:**
- `success`: `✓ Erfolgreich gebucht für <Wochentag>, <Datum>`
- `already_booked`: `ℹ Bereits gebucht für <Wochentag>, <Datum>`
- `failed`: `✕ <Fehlermeldung>`

Das Datum für das Feedback wird im Frontend berechnet (gleiche Logik wie Backend: nächster passender Wochentag).

### DashboardPage

Neue Funktion `handleExecute`:

```typescript
async function handleExecute(job: Job) {
  return await executeJob(job.id)
}
```

`JobCard` erhält `onExecute={isAdmin() ? handleExecute : undefined}`.

## Visuelles Design

Alle vier Zustände wurden als Mockup abgestimmt (siehe Visual Companion Session). Die Action-Bar hat die Reihenfolge: **Bearbeiten | Jetzt buchen | [Spacer] | Löschen**.

## Nicht in Scope

- Fehler-E-Mails bei manueller Ausführung (kein E-Mail-Versand wie im Worker)
- Ausführung für fremde Jobs (nur eigene Jobs)
- Ausführung im Admin-Tab „Jobs"
- Asynchrone Ausführung / Polling
