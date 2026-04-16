# Design: Facility-Suche mit zuletzt genutzten Einträgen

**Datum:** 2026-04-16  
**Status:** Genehmigt

## Kontext

Die Facility-Auswahl im JobModal ist aktuell auf zwei hartcodierte Einträge in `frontend/src/types.ts` beschränkt. Nutzer können keine anderen Eversports-Facilities auswählen. Ziel ist eine dynamische Suche über die Eversports-Marketplace-API sowie die Anzeige der 5 zuletzt genutzten Facilities beim Öffnen der Auswahl.

---

## Architektur

```
Frontend (Combobox)
  ├── kein Text         → GET /api/facilities/recent
  ├── 1–4 Zeichen       → zuletzt genutzte anzeigen + Hinweis
  └── ≥ 5 Zeichen       → GET /api/facilities/search?q=<query>
                              └── Proxy → Eversports Marketplace GraphQL
```

---

## Backend

### Schritt 0: Eversports-API-Recherche

Vor der Implementierung: Eversports-Marketplace im Browser öffnen, in DevTools → Network die Suchanfrage mitloggen und das GraphQL-Query (inkl. Endpoint-URL, Operation-Name, Variablen) extrahieren. Die Marketplace-Suche erfordert vermutlich keinen Login.

### Neuer Endpoint: `GET /api/facilities/search`

- **Query-Parameter:** `q` (string, Pflicht)
- **Validierung:** Weniger als 5 Zeichen → HTTP 400
- **Logik:** Proxied das ermittelte Eversports-GraphQL-Query
- **Response:** `[{ "id": string, "name": string }]`
- **Datei:** `backend/api/facilities.py` (neu), eingebunden in `backend/main.py`

### Neuer Endpoint: `GET /api/facilities/recent`

- **Logik:** Liest aus `booking_jobs` die letzten 5 eindeutigen Facilities des eingeloggten Nutzers
- **SQL-Logik:** `GROUP BY facility_id, facility_name ORDER BY MAX(created_at) DESC LIMIT 5`
- **Response:** `[{ "id": string, "name": string }]`
- **Datei:** `backend/api/facilities.py` (selbe Datei wie oben)

### DB-Schema-Änderung: `booking_job`

Neue Spalte:
```
facility_name: str  (nullable=False)
```

- **Modell:** `backend/models/booking_job.py`
- **Schemas:** `backend/schemas/job.py` — `JobCreate`, `JobUpdate`, `JobResponse` um `facility_name` erweitern
- **Migration:** Alembic-Migration erstellen; neue Spalte mit `server_default=''` (leerer String), danach `nullable=False`; bestehende Jobs behalten ihre `facility_id`, `facility_name` bleibt leer — JobCard zeigt in diesem Fall die `facility_id` als Fallback an

---

## Frontend

### Neue Komponente: `FacilityCombobox`

**Datei:** `frontend/src/components/FacilityCombobox.tsx`

**Props:**
```typescript
{
  value: { id: string; name: string } | null;
  onChange: (facility: { id: string; name: string }) => void;
}
```

**Verhalten:**

| Zustand | Anzeige |
|---|---|
| Geöffnet, kein Text | Letzte 5 Facilities (`/api/facilities/recent`) |
| 1–4 Zeichen getippt | Letzte 5 Facilities + Hinweis „Mindestens 5 Zeichen für Suche" |
| ≥ 5 Zeichen getippt | Suchergebnisse von Eversports (debounced 300 ms) |
| Facility ausgewählt | Name im Input angezeigt |

**Implementierungsdetails:**
- Debounce-Delay: 300 ms
- Dropdown schließt bei Klick außerhalb (click-outside-Handler)
- Loading-Spinner während Suchanfrage
- Fehlermeldung bei API-Fehler

### Änderungen an bestehenden Komponenten

**`frontend/src/components/JobModal.tsx`**
- `<select>` für Facility durch `<FacilityCombobox>` ersetzen
- Formularstate: `facility_id` + `facility_name` statt nur `facility_id`
- Initialer Wert beim Bearbeiten eines Jobs aus `job.facility_name` + `job.facility_id`

**`frontend/src/components/JobCard.tsx`**
- `FACILITIES.find(...)` entfernen
- Direkt `job.facility_name` verwenden

**`frontend/src/types.ts`**
- `FACILITIES`-Konstante entfernen
- `Job`-Typ um `facility_name: string` erweitern

**`frontend/src/api/jobs.ts`**
- Neue API-Funktionen: `searchFacilities(q: string)` und `getRecentFacilities()`

---

## Verifikation

1. **Backend-Endpoints testen:**
   - `GET /api/facilities/search?q=cross` → HTTP 400 (zu kurz)
   - `GET /api/facilities/search?q=crossfit` → Eversports-Ergebnisse
   - `GET /api/facilities/recent` → Letzte 5 Facilities des Nutzers (oder leer bei neuem Konto)

2. **Frontend-Fluss testen:**
   - JobModal öffnen → letzte Facilities erscheinen sofort
   - 3 Zeichen tippen → kein API-Call, Hinweis sichtbar
   - 5+ Zeichen tippen → Suchergebnisse erscheinen nach ~300 ms
   - Facility auswählen → Name im Input, Job wird mit `facility_name` gespeichert
   - Gespeicherter Job → `facility_name` korrekt in JobCard angezeigt

3. **Regression:**
   - Bestehende Jobs haben `facility_name = ""` → JobCard zeigt `facility_id` als Fallback an
