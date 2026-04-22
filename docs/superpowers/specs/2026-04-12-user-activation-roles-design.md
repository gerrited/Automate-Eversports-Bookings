# Benutzeraktivierung & Rollen — Design Spec

**Datum:** 2026-04-12  
**Status:** Genehmigt

## Übersicht

Neue Konten erfordern eine Admin-Freischaltung, bevor sie die App nutzen können. Ein einfaches Zwei-Rollen-System (`user` / `admin`) steuert, wer Konten verwalten darf. Der erste registrierte Benutzer wird automatisch Admin. Admins können Benutzer vom Dashboard aus aktivieren und deaktivieren.

---

## 1. Datenbankänderungen

Zwei neue Spalten in der `users`-Tabelle:

| Spalte | Typ | Standard | Hinweise |
|--------|-----|---------|-------|
| `active` | Boolean | `False` | Ob das Konto freigegeben ist |
| `role` | String | `"user"` | Entweder `"user"` oder `"admin"` |

**Alembic-Migration:** Fügt beide Spalten hinzu. Bestehende Benutzer in der DB erhalten als Migrationswerte `active=True` und `role="user"`, damit niemand ausgesperrt wird.

---

## 2. Backend

### Login-Endpunkt (`POST /auth/login`)

- **Neuer Benutzer (erster in der DB):** Angelegt mit `active=True`, `role="admin"`
- **Neuer Benutzer (nicht der erste):** Angelegt mit `active=False`, `role="user"`
- **Bestehender Benutzer, `active=False`:** Gibt HTTP 403 zurück mit `"Account nicht freigegeben"`
- **Bestehender Benutzer, `active=True`:** Login erfolgreich, gibt `{access_token, role}` zurück

Das `TokenResponse`-Schema erhält ein `role: str`-Feld.

### Dependencies

**`get_current_active_user`**  
Erweitert `get_current_user`. Prüft zusätzlich `user.active == True`. Gibt 403 zurück bei inaktivem Benutzer. Alle bestehenden geschützten Routen wechseln zu dieser Dependency.

**`require_admin`**  
Erweitert `get_current_active_user`. Prüft zusätzlich `user.role == "admin"`. Gibt 403 zurück bei fehlender Admin-Rolle. Wird ausschließlich auf Admin-Routen verwendet.

### Admin-Routen (`/admin/users`)

Alle Routen erfordern die `require_admin`-Dependency.

| Methode | Pfad | Beschreibung |
|--------|------|-------------|
| `GET` | `/admin/users` | Gibt Liste aller Benutzer zurück: `id`, `email`, `active`, `role`, `created_at` |
| `PATCH` | `/admin/users/{id}/active` | Setzt `active` für den angegebenen Benutzer. Gibt 400 zurück, wenn ein Admin versucht, sich selbst zu deaktivieren. |

---

## 3. Frontend

### Login-Flow

- `api/auth.ts`: Nach erfolgreichem Login werden `token` und `role` im `localStorage` gespeichert
- Beim Logout: Beide Werte werden aus `localStorage` entfernt
- Bei 403 vom Login: `LoginPage` zeigt Fehlermeldung `"Dein Account wartet auf Freigabe"`

### Dashboard

- Neue Hilfsfunktion `isAdmin()` liest `role` aus `localStorage`
- Unterhalb der Buchungsliste: Wenn `isAdmin()` `true` ist, wird eine neue `UserManagementSection`-Komponente gerendert
- `UserManagementSection` lädt alle Benutzer via `GET /admin/users` und stellt sie als Liste mit E-Mail und einem Aktivieren/Deaktivieren-Toggle dar
- Der Toggle für das eigene Admin-Konto ist `disabled` (UX-Schutz; das Backend ist die maßgebliche Absicherung)

### Neue API-Datei `api/users.ts`

- `listUsers()` → `GET /admin/users`
- `setUserActive(id: string, active: boolean)` → `PATCH /admin/users/{id}/active`

---

## 4. Fehlerbehandlung

| Szenario | Backend | Frontend |
|----------|---------|----------|
| Inaktiver Benutzer loggt sich ein | 403 `"Account nicht freigegeben"` | Fehlermeldung auf der Login-Seite |
| Nicht-Admin ruft Admin-Route auf | 403 | — (Button nicht für Nicht-Admins angezeigt) |
| Admin versucht sich selbst zu deaktivieren | 400 | Toggle ist deaktiviert |
| Inaktiver Benutzer ruft geschützte Route auf | 403 | — (kann Dashboard nicht erreichen) |

---

## 5. Nicht im Scope

- Rollenerhöhung (Admins können andere Benutzer nicht zu Admins machen)
- E-Mail-Benachrichtigungen bei Aktivierung
- Passwort-Reset-Flow
- Erster Admin via Env-Variable oder Seed-Script (manueller DB-Eintrag für initialen Admin)
