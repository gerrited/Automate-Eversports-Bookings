# Admin "Alle Buchungen" – Design Spec

**Datum:** 2026-04-19  
**Status:** Genehmigt

## Übersicht

Einen neuen read-only Admin-Tab "Alle Buchungen" im Dashboard hinzufügen, der alle konfigurierten Buchungen aller Benutzer auflistet, filterbar nach Benutzername (E-Mail), paginiert mit 25 Einträgen pro Seite.

## Backend

### Neuer Endpoint

`GET /admin/jobs` in `backend/api/admin.py`, geschützt mit `require_admin`.

Gibt alle `BookingJob`-Datensätze zurück, gejoint mit dem zugehörigen `User` und einer Ausführungsanzahl aus den Logs:

```python
db.query(
    BookingJob,
    User.email.label("user_email"),
    func.count(BookingLog.id).label("execution_count")
)
.join(User, User.id == BookingJob.user_id)
.outerjoin(BookingLog, BookingLog.job_id == BookingJob.id)
.group_by(BookingJob.id)
.order_by(BookingJob.weekday, BookingJob.target_time, User.email)
.all()
```

### Neues Schema

`AdminJobResponse` in `backend/schemas/job.py`, erweitert die bestehenden `JobResponse`-Felder:

| Field | Type | Source |
|-------|------|--------|
| `id` | str | BookingJob |
| `weekday` | int | BookingJob |
| `target_time` | time | BookingJob |
| `facility_id` | str | BookingJob |
| `facility_name` | str | BookingJob |
| `class_name` | str | BookingJob |
| `days_in_advance` | int | BookingJob |
| `enabled` | bool | BookingJob |
| `one_time` | bool | BookingJob |
| `created_at` | datetime | BookingJob |
| `user_email` | str | User (JOIN) |
| `execution_count` | int | COUNT(BookingLog) |

## Frontend

### Neuer Typ

`AdminJob` in `frontend/src/types.ts`:

```typescript
export interface AdminJob extends Job {
  user_email: string
  execution_count: number
}
```

### Neue API-Funktion

`listAllJobs(): Promise<AdminJob[]>` in `frontend/src/api/adminJobs.ts`:

```typescript
import { apiFetch } from './client'
import type { AdminJob } from '../types'

export const listAllJobs = (): Promise<AdminJob[]> =>
  apiFetch('/api/admin/jobs')
```

### Neue Komponente: `AllJobsSection`

Datei: `frontend/src/components/AllJobsSection.tsx`

Verhält sich analog zu `UserManagementSection`:
- Lädt alle Buchungen beim Mount via `listAllJobs()`
- Textfilter: filtert nach `user_email` (case-insensitive, clientseitig)
- Paginierung: `PAGE_SIZE = 25`, gleiche Zurück/Weiter-Controls
- Zeigt Zusammenfassung: `N von M Buchungen · Seite X von Y`

Each row displays:
- **Line 1 (bold):** `user_email`
- **Line 2:** `Wochentag · HH:MM Uhr · class_name`
- **Line 3 (muted):** `facility_name · days_in_advance Tage im Voraus · [Einmalig]`
- **Right side:** `execution_count × ausgeführt` (muted badge)

No edit/delete/toggle actions (read-only).

### Tab-Integration

In `DashboardPage.tsx`:

- Tab-Typ erweitern auf `'buchungen' | 'benutzer' | 'alle-buchungen'`
- Hash `#all-jobs` für den neuen Tab hinzufügen
- Tab-Button "Alle Buchungen" hinzufügen (nur für Admins sichtbar, wie bestehende Tabs)
- `<AllJobsSection />` rendern wenn `activeTab === 'alle-buchungen'`
- Swipe-Geste (touchstart/touchend) auf alle drei Tabs erweitern

## Fehlerbehandlung

- Ladezustand: "Lädt…"-Text anzeigen (wie andere Sektionen)
- Leerzustand: "Keine Buchungen gefunden." zentriert
- API-Fehler: stillschweigend ignoriert (konsistent mit bestehendem Muster im Code)

## Nicht im Scope

- Admins bearbeiten/löschen/togglen Buchungen aus dieser Ansicht
- Server-seitige Paginierung oder Filterung
- Sortiercontrols
