# Design: Admin-Nachricht an einzelne User

**Datum:** 2026-04-26

## Zusammenfassung

Admins können über die User-Verwaltung eine E-Mail-Nachricht (Betreff + Freitext) an einen einzelnen User senden. Der User erhält die Nachricht per E-Mail via Resend.

## Backend

### Neuer API-Endpoint

```
POST /admin/users/{user_id}/message
Authorization: JWT (Admin required)
Body: { "subject": "string", "content": "string" }
Response 200: { "detail": "Nachricht gesendet" }
Response 404: User nicht gefunden
```

- Endpoint liegt in `backend/api/admin.py`, geschützt durch `require_admin`
- Lädt User aus DB, wirft 404 wenn nicht gefunden
- Ruft `send_admin_message(user.email, subject, content)` auf (best-effort, kein Crash)

### Neue E-Mail-Funktion

`send_admin_message(user_email: str, subject: str, content: str)` in `backend/core/email.py`:
- Folgt dem bestehenden Pattern (resend.Emails.send, Fehler werden geloggt)
- Rendert `admin_message.html` mit Variablen: `subject`, `content`, `frontend_url`

### Neues E-Mail-Template

`backend/templates/email/admin_message.html`:
- Selbes Dark-Theme wie alle anderen Templates
- Zeigt Betreff als Überschrift, Inhalt als Fließtext (Zeilenumbrüche als `<br>`)
- Variablen: `subject`, `content`, `frontend_url`

## Frontend

### API-Funktion

Neue Funktion `sendUserMessage(userId: string, subject: string, content: string): Promise<void>` in `frontend/src/api/users.ts`.

### UI-Änderungen in `UserManagementSection.tsx`

**Neuer State:**
- `messagingUser: UserRecord | null` — der User, an den gerade eine Nachricht geschrieben wird

**Button auf User-Karte:**
- "Nachricht"-Button neben dem Aktivieren/Deaktivieren-Button auf jeder User-Karte

**Modal (wenn `messagingUser` gesetzt):**
- Titel: "Nachricht an {user.email}"
- Input: Betreff (Pflichtfeld)
- Textarea: Inhalt (Pflichtfeld)
- Fehleranzeige: Inline-Meldung im Modal bei API-Fehler
- Buttons: "Abbrechen" (schließt Modal), "Senden" (ruft API auf, schließt bei Erfolg)
- Analoges Layout zum bestehenden `pendingLimit`-Confirm-Modal

## Nicht enthalten

- Broadcast an alle User
- Gespeicherte Nachrichten / Verlauf
- Vorlagen für Nachrichten
