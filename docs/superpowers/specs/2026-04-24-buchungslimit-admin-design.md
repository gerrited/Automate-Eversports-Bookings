# Design: Buchungslimit pro Benutzer (Admin-konfigurierbar)

**Datum:** 2026-04-24  
**Status:** Bereit zur Implementierung

## Ziel

Admins sollen das maximale Buchungslimit (`max_active_jobs`) eines Benutzers direkt in der Benutzer-Karte des Admin-Dashboards einsehen und ändern können.

## Kontext

Das Feld `max_active_jobs` existiert bereits auf dem `User`-Modell (`Integer`, nullable, `null` = unbegrenzt) und wird in `backend/api/jobs.py` bereits beim Erstellen und Aktivieren von Jobs geprüft. Es fehlt bisher die Admin-API und die Frontend-UI zum Bearbeiten dieses Werts.

## Datenmodell

Keine Schemaänderung nötig. `max_active_jobs` ist bereits in der Datenbank vorhanden.

**`UserResponse`-Schema** (`backend/schemas/user.py`) wird um `max_active_jobs: Optional[int]` ergänzt, damit das Frontend den Wert kennt.

**`UserRecord`-Interface** (`frontend/src/types.ts`) bekommt `max_active_jobs: number | null`.

## Backend-API

### Neuer Endpoint

```
PATCH /admin/users/{user_id}/limit
```

- **Authentifizierung:** `Depends(require_admin)` — nur Admins können das Limit ändern
- **Request-Body:** `{"max_active_jobs": 5}` oder `{"max_active_jobs": null}` für kein Limit
- **Response:** Aktualisiertes `UserResponse`

### Logik bei Limit-Unterschreitung

Wenn `max_active_jobs` (neu) < Anzahl aktiver Jobs des Benutzers:

1. Alle aktiven Jobs des Benutzers werden deaktiviert (`enabled = False`)
2. Eine E-Mail an den Benutzer wird gesendet
3. Alles in einer Datenbank-Transaktion

Wenn `max_active_jobs` (neu) >= Anzahl aktiver Jobs oder `null`: nur Limit speichern, keine weiteren Aktionen.

### Neues Schema

```python
class SetLimitRequest(BaseModel):
    max_active_jobs: Optional[int] = None
```

## E-Mail

Neues Template `backend/templates/email/limit_enforced.html`.

Variablen: `max_active_jobs` (neues Limit), `frontend_url`

Inhalt: Benutzer wird informiert, dass sein Buchungslimit geändert wurde und alle aktiven Jobs deaktiviert wurden.

## Frontend

### Badge in der Benutzerliste (`UserManagementSection.tsx`)

Das Limit wird als klickbares Badge neben den anderen Status-Tags angezeigt:

- Mit Limit: `Limit: X ✎` (lila Badge)
- Ohne Limit: `Kein Limit ✎` (grauer Badge)

### Inline-Edit-Verhalten

Klick auf das Badge ersetzt es durch ein Inline-Formular mit:
- Zahlen-Input (leer = kein Limit)
- Bestätigen-Button (`✓`)
- Abbrechen-Button (`✕`)

### Bestätigungs-Dialog

Erscheint **nur wenn** neues Limit < `job_count` des Benutzers. Text:

> "Das neue Limit von X liegt unter den aktuell Y aktiven Jobs von [E-Mail]. Alle aktiven Jobs werden deaktiviert und der Benutzer per E-Mail informiert."

Buttons: „Abbrechen" / „Ja, Limit setzen"

Falls kein Bestätigungs-Dialog nötig: Änderung wird direkt nach Bestätigen gespeichert.

### API-Client

Neue Funktion in `frontend/src/api/users.ts`:

```typescript
export async function setUserLimit(id: string, max_active_jobs: number | null) {
  // PATCH /api/admin/users/{id}/limit
}
```

## Nicht im Scope

- Kein systemweiter Standard-Limit (globaler Default)
- Kein manuelles "Limit erzwingen" ohne Limit-Änderung
