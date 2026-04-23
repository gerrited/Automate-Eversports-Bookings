# Admin Job Card: Aufgliederung der Ausführungen

**Datum:** 2026-04-23
**Status:** Genehmigt

## Ziel

In der Admin-Ansicht soll jede Job-Karte anzeigen, wie häufig ein Job erfolgreich war, wie häufig ein Fehler aufgetreten ist und wie häufig der Kurs bereits gebucht war — anstatt nur die Gesamtanzahl der Ausführungen.

## Entscheidungen

- `already_booked` wird als **eigene Kategorie** angezeigt (nicht als Erfolg oder Fehler).
- Die Darstellung verwendet eine **segmentierte Mini-Fortschrittsleiste** (Option C aus dem Brainstorming), mit Zahlen über den Segmenten und der Gesamtanzahl darunter.
- `execution_count` wird aus `AdminJobResponse` **entfernt**; die Summe der drei neuen Felder ergibt dieselbe Information.

## Backend

### `backend/schemas/job.py`

`AdminJobResponse` wird angepasst: `execution_count: int` entfällt, drei neue Felder kommen hinzu:

```python
class AdminJobResponse(JobResponse):
    user_email: str
    success_count: int
    failed_count: int
    already_booked_count: int
```

### `backend/api/admin.py` — `GET /api/admin/jobs`

Die SQL-Abfrage in `list_all_jobs` ersetzt `func.count(BookingLog.id)` durch drei bedingte Aggregationen:

```python
func.sum(
    case((BookingLog.status == 'success', 1), else_=0)
).label("success_count"),
func.sum(
    case((BookingLog.status == 'failed', 1), else_=0)
).label("failed_count"),
func.sum(
    case((BookingLog.status == 'already_booked', 1), else_=0)
).label("already_booked_count"),
```

Die Konstruktion des `AdminJobResponse`-Objekts wird entsprechend angepasst.

## Frontend

### `frontend/src/types.ts`

`AdminJob` erhält drei neue Felder anstelle von `execution_count`:

```typescript
interface AdminJob extends Job {
  user_email: string
  success_count: number
  failed_count: number
  already_booked_count: number
}
```

### `frontend/src/components/AllJobsSection.tsx`

Das bisherige `{job.execution_count}× ausgeführt` wird durch eine segmentierte Fortschrittsleiste ersetzt:

- Drei Segmente: grün (`success_count`), rot (`failed_count`), grau (`already_booked_count`)
- Über der Leiste: Zahlen mit Symbolen — `✓ 12  ✗ 3  ⊘ 5`
- Unter der Leiste: Gesamtanzahl (`20× gesamt`)
- Wenn alle drei Counts 0 sind: kein Balken, stattdessen Text „Noch nicht ausgeführt"
- Breite der Segmente proportional zur jeweiligen Anzahl
- Die Balken-Darstellung wird direkt in `AllJobsSection.tsx` umgesetzt (kein separates Component nötig bei dieser Größe)

## Keine weiteren Änderungen

- Die Worker-Templates, Log-Endpoints und die normale Benutzeransicht bleiben unverändert.
- Das Admin-API für Benutzer (`GET /api/admin/users`) ist nicht betroffen.
