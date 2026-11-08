# Design: Admin-Tab "Logs"

**Datum:** 2026-04-25  
**Status:** Genehmigt

## Überblick

Admins erhalten einen neuen Tab "Logs" im Dashboard, der alle `booking_logs` aller User anzeigt — vollständig mit Job- und User-Kontext, sortiert nach Ausführungsdatum (neueste zuerst), optional filterbar nach User-E-Mail.

---

## Backend

### Neuer Endpunkt

```
GET /api/admin/logs
```

**Query-Parameter:**
- `user_email` (optional) — Filter nach User-E-Mail (case-insensitive Teilstring-Suche)
- `page` (optional, default: 1) — Seitennummer für Pagination

**Pagination:** PAGE_SIZE = 50, Response enthält `total` und `items`.

**Autorisierung:** Nur für Admins (`require_admin`-Dependency, wie bestehende Admin-Endpunkte).

**Datenbankabfrage:** JOIN über `booking_logs` → `booking_jobs` → `users`, sortiert nach `booking_logs.executed_at DESC`.

### Neues Schema `AdminLogResponse`

```python
class AdminLogResponse(BaseModel):
    # Log-Felder
    id: str
    job_id: str
    executed_at: datetime
    target_date: date
    status: str          # success | failed | already_booked | waitlist
    message: Optional[str]
    # Job-Felder
    class_name: str
    facility_name: str
    target_time: str
    weekday: int
    debug: bool
    # User-Felder
    user_email: str
```

### Paginiertes Response-Schema

```python
class AdminLogsPage(BaseModel):
    items: list[AdminLogResponse]
    total: int
    page: int
    page_size: int
```

**Implementierungsort:** `backend/api/admin.py` (neuer Route), `backend/schemas/log.py` (neues Schema).

---

## Frontend

### Neuer Tab

- Tab-Label: "Logs"
- Hash: `#logs`
- Nur für Admins sichtbar (analog zu `#users` und `#all-jobs`)

### Neue Komponente `AllLogsSection`

**Datei:** `frontend/src/components/AllLogsSection.tsx`

**Verhalten:**
- Lädt automatisch beim Tab-Wechsel (Seite 1)
- Text-Eingabefeld oben: Filter nach User-E-Mail (debounced 300ms, setzt Pagination auf Seite 1 zurück)
- Loading-Spinner während Fetch
- Leerer Zustand: "Keine Logs gefunden"
- Fehlerfall: Fehlermeldung inline

**Tabelle — Spalten:**
| Spalte | Inhalt |
|--------|--------|
| Ausgeführt am | `executed_at` formatiert mit `toLocaleString('de-DE')` |
| User | `user_email` |
| Kursname | `class_name` |
| Sportstätte | `facility_name` |
| Uhrzeit | `target_time` |
| Wochentag | Wochentagsname (aus `weekday`-Integer) |
| Zieldatum | `target_date` |
| Status | Farbiges Badge (grün/rot/grau/gelb) |
| Debug | Checkbox/Icon wenn `debug === true` |
| Nachricht | Gekürzter Text, klickbar für vollständige Anzeige |

**Status-Farben** (analog zu `LogDrawer`):
- `success` → grün
- `failed` → rot
- `already_booked` → grau
- `waitlist` → gelb

**Pagination:** Seiten-Navigation unten, PAGE_SIZE = 50.

### Neuer API-Client

**Datei:** `frontend/src/api/adminLogs.ts`

```typescript
export const listAllLogs = (page: number, userEmail?: string): Promise<AdminLogsPage> =>
  apiFetch(`/api/admin/logs?page=${page}${userEmail ? `&user_email=${encodeURIComponent(userEmail)}` : ''}`)
```

### Neuer Typ

**Datei:** `frontend/src/types.ts` (ergänzt)

```typescript
export interface AdminLog {
  id: string
  job_id: string
  executed_at: string
  target_date: string
  status: 'success' | 'failed' | 'already_booked' | 'waitlist'
  message: string | null
  class_name: string
  facility_name: string
  target_time: string
  weekday: number
  debug: boolean
  user_email: string
}

export interface AdminLogsPage {
  items: AdminLog[]
  total: number
  page: number
  page_size: number
}
```

---

## Datenfluss

1. Admin öffnet Tab `#logs` → `AllLogsSection` mountet, Fetch startet
2. GET `/api/admin/logs?page=1` → Backend joined Tabellen, gibt sortierte Liste zurück
3. Optional: Admin tippt in Filter-Feld → nach 300ms Debounce neuer Fetch mit `user_email=...&page=1`
4. Pagination: Klick auf Seite N → Fetch mit `page=N`

---

## Fehlerbehandlung

- 401/403: `apiFetch` wirft bereits, bestehender Auth-Handler greift
- Leere Ergebnisse: "Keine Logs gefunden"-Meldung
- Netzwerkfehler: Fehlermeldung inline in der Komponente

---

## Nicht im Scope

- Logs löschen oder archivieren
- Export (CSV/JSON)
- Filter nach Status oder Datumsbereich
