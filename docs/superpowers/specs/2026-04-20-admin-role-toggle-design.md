# Design: Admin-Rolle-Toggle im Hamburger-Menü

Datum: 2026-04-20

## Kontext

Admins sollen im Hamburger-Menü eine Checkbox "Admin" sehen, mit der sie schnell zwischen Admin-Ansicht und User-Ansicht wechseln können. Dafür muss nach dem Login an einer zweiten localStorage-Stelle gespeichert werden, ob der User tatsächlich Admin ist — unabhängig von der aktuell aktiven Rolle.

## Datenmodell (localStorage)

| Key | Typ | Beschreibung |
|---|---|---|
| `role` | `"admin" \| "user"` | Aktiv angezeigte Rolle — wird per Checkbox getoggelt |
| `isActualAdmin` | `"true"` / nicht vorhanden | Unveränderlich nach Login; bestimmt ob Checkbox sichtbar ist |

`isActualAdmin` wird nur beim Login gesetzt (wenn Backend `role === "admin"` zurückgibt) und nur beim Logout entfernt. Es wird nie durch die Checkbox verändert.

## Änderungen

### `frontend/src/api/client.ts`

- `setIsActualAdmin(value: boolean)`: setzt `localStorage.setItem('isActualAdmin', 'true')` wenn `true`, sonst `removeItem`
- `isActualAdmin(): boolean`: gibt `localStorage.getItem('isActualAdmin') === 'true'` zurück
- `setRole(role: string)`: setzt `localStorage.setItem('role', role)` — neue exportierte Funktion für den Rollenwechsel
- `clearToken()`: entfernt zusätzlich `isActualAdmin` aus localStorage

### `frontend/src/api/auth.ts`

Nach erfolgreichem Login: wenn `data.role === 'admin'`, wird `setIsActualAdmin(true)` aufgerufen. Einmalig pro Login-Session.

### `frontend/src/components/HamburgerMenu.tsx`

- Neues Prop `isActualAdmin: boolean`
- Wenn `isActualAdmin === true`: Checkbox mit Label "Admin" wird unterhalb von "Einstellungen" angezeigt
- Checkbox-Zustand spiegelt `localStorage.getItem('role') === 'admin'`
- Beim Umschalten:
  1. `setRole('admin')` oder `setRole('user')` aufrufen
  2. `window.dispatchEvent(new Event('auth-changed'))` dispatchen

### `frontend/src/pages/DashboardPage.tsx`

- `isActualAdmin()` auslesen und als Prop an `HamburgerMenu` übergeben
- Sicherstellen, dass der bestehende `auth-changed` Listener eine State-Änderung auslöst, die einen Re-Render erzwingt (sodass `isAdmin()` neu ausgewertet wird)

## Verhalten

- Ein Admin sieht die Checkbox "Admin" (angehakt = Admin-Ansicht, abgehakt = User-Ansicht)
- Beim Umschalten wechselt die komplette Dashboard-Ansicht sofort (Admin-Tabs erscheinen/verschwinden)
- Normaler User sieht die Checkbox nie
- Beim Logout werden beide localStorage-Werte geleert
- Nach Page-Reload bleibt der gewählte Modus erhalten (da beide Werte in localStorage liegen)

## Nicht in Scope

- Keine Backend-Änderungen — das Backend erzwingt die echte Rolle weiterhin über `require_admin`
- Keine neuen Rollen außer `"admin"` und `"user"`
- Kein separates UI-Feedback (Toast o. ä.) beim Rollenwechsel
