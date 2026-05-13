# Design: Admin Push-Test-Button in der User Card

**Datum:** 2026-05-13  
**Status:** Genehmigt

## Überblick

Admins sollen über die User-Verwaltung manuell eine Test-Push-Notification an alle registrierten Geräte eines Benutzers senden können — analog zum bestehenden „Nachricht"-Button für E-Mails. Die Nachricht ist fest vorgegeben (`{ title: "Test", body: "Testnachricht vom Admin" }`), kein Modal nötig.

---

## Backend

### 1. `backend/core/push.py` (neu)

Neue Datei, die die gemeinsame Push-Sende-Logik enthält:

- **`send_to_subscription(sub, payload, db)`** — bisher `_send_to_subscription` in `worker/notifications.py`. Versendet einen Push via `webpush()`. Bei HTTP-410-Antwort (abgelaufene Subscription) wird die Subscription aus der DB gelöscht.
- **`send_test_push_to_user(db, user_id) -> int`** — lädt alle Subscriptions des Users, sendet den fixen Test-Payload an jede, gibt die Anzahl der angesprochenen Subscriptions zurück.

Test-Payload:
```json
{ "title": "Test", "body": "Testnachricht vom Admin" }
```

Voraussetzung: Umgebungsvariablen `VAPID_PRIVATE_KEY` und `VAPID_SUBJECT` müssen gesetzt sein.

### 2. `worker/notifications.py` (Update)

- `_send_to_subscription` wird entfernt.
- Import: `from backend.core.push import send_to_subscription`.
- Alle vorhandenen Aufrufe bleiben funktional identisch.

### 3. `backend/schemas/user.py` (Update)

`UserResponse` bekommt ein neues Feld:

```python
push_subscription_count: int = 0
```

### 4. `backend/api/admin.py` (Update)

**`GET /admin/users`:** Query wird um einen weiteren Outerjoin und Count erweitert:

```python
db.query(
    User,
    func.count(BookingJob.id).label("job_count"),
    func.sum(case(...)).label("active_job_count"),
    func.count(PushSubscription.id).label("push_subscription_count"),
)
.outerjoin(BookingJob, BookingJob.user_id == User.id)
.outerjoin(PushSubscription, PushSubscription.user_id == User.id)
.group_by(User.id)
```

`UserResponse` wird überall, wo es gebaut wird (`PATCH /active`, `PATCH /limit`), um `push_subscription_count` ergänzt (via separater `db.query(func.count(...))` wie bei `job_count`).

**Neuer Endpunkt:**

```
POST /api/admin/users/{user_id}/push-test
```

- Nur für Admins (`require_admin`).
- Ruft `send_test_push_to_user(db, user_id)` auf.
- Gibt **204** zurück (auch wenn keine Subscriptions vorhanden).
- Gibt **503** zurück, wenn `VAPID_PRIVATE_KEY` oder `VAPID_SUBJECT` fehlen.
- Gibt **404** zurück, wenn der User nicht existiert.

---

## Frontend

### 1. `frontend/src/types.ts`

```typescript
export interface UserRecord {
  // ... bestehende Felder ...
  push_subscription_count: number  // neu
}
```

### 2. `frontend/src/api/users.ts`

Neue Funktion, thematisch neben `sendUserMessage`:

```typescript
export async function sendTestPush(userId: string): Promise<void> {
  await apiFetch(`/api/admin/users/${userId}/push-test`, { method: 'POST' })
}
```

### 3. `frontend/src/components/UserManagementSection.tsx`

**State:**
- `pushingUser: string | null` — ID des Users, für den gerade gesendet wird
- `pushSuccessUser: string | null` — ID des Users, für den zuletzt erfolgreich gesendet wurde (für 2s ✓-Anzeige)

**Button (neben „Nachricht"):**

- Icon: Glocke (SVG), auf Desktop zusätzlich Text „Push"
- Disabled wenn `user.push_subscription_count === 0` oder `pushingUser === user.id`
- `title`-Attribut: „Kein Gerät registriert" wenn `push_subscription_count === 0`
- Bei Klick: `sendTestPush(user.id)` aufrufen
- Während Senden: Button deaktiviert
- Nach Erfolg: Button zeigt für 2 Sekunden ein ✓-Icon (kein Modal)
- Bei Fehler: Konsolen-Error, kein Toast (minimaler Aufwand, da dies ein Admin-Werkzeug ist)

**Variante (optional):** Ein `title`-Tooltip beim deaktivierten Button reicht; kein eigenes Tooltip-Overlay nötig.

---

## Fehlerbehandlung

| Situation | Verhalten |
|-----------|-----------|
| User hat keine Subscriptions | Button disabled im Frontend; Backend gibt 204 zurück (defensiv) |
| VAPID-Keys fehlen | Backend gibt 503 zurück; Frontend zeigt keinen Fehler (Admin-Kontext, seltener Fall) |
| Subscription abgelaufen (410) | Wird in `send_to_subscription` bereinigt, kein Fehler nach oben |
| User nicht gefunden | Backend gibt 404 |

---

## Nicht im Scope

- Eigener Nachrichtentext für Push (kein Modal, fixer Payload)
- Toast/Notification-UI für Fehlerfall (Admin-Werkzeug, minimale UI)
- Push-Subscription-Count in der Worker-Logik (unverändert)
