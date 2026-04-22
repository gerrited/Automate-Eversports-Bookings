# Admin Test-Mail Feature

**Datum:** 2026-04-22

## Kontext

Admins wollen die bestehenden System-Mails (Layout, Text) prüfen können, ohne echte Buchungsereignisse abwarten zu müssen. Derzeit gibt es keine Möglichkeit, Mails testweise auszulösen. Diese Funktion ermöglicht es Admins, jede Mail-Art mit realistischen Dummy-Daten an die eigene E-Mail-Adresse zu senden.

## Bestehende Mails

| Typ | Funktion | Datei |
|-----|----------|-------|
| `new_user` | `send_new_user_notification` | `backend/core/email.py` |
| `account_activated` | `send_account_status_email(..., True)` | `backend/core/email.py` |
| `account_deactivated` | `send_account_status_email(..., False)` | `backend/core/email.py` |
| `booking_failure` | `send_booking_failure_email` | `worker/email.py` |
| `debug_cancel_failure` | `send_debug_cancel_failure_email` | `worker/email.py` |

## Architektur

### Backend

**Neuer Endpoint:** `POST /api/admin/test-email`
- Geschützt durch `require_admin` (aus `backend/api/deps.py`)
- Request body: `{"type": "<mail_typ>"}`
- Sendet an die E-Mail-Adresse des eingeloggten Admins
- Gibt 503 zurück wenn `RESEND_API_KEY` oder `FROM_EMAIL` nicht gesetzt sind

**Neue Funktion:** `send_test_email(admin_email: str, email_type: str)` in `backend/core/email.py`
- Enthält hardcodierte, realistische Dummy-Daten für jeden Mail-Typ
- Ruft direkt `resend.Emails.send()` auf (gleiche Struktur wie bestehende Funktionen)
- Kein Import aus `worker/email.py` — Dummy-Templates inline, um Kopplung zu vermeiden

**Mail-Typen als Literal:** `"new_user" | "account_activated" | "account_deactivated" | "booking_failure" | "debug_cancel_failure"`

### Frontend

**`HamburgerMenu.tsx`** — neuer Eintrag "Test-Mails" sichtbar wenn `isAdmin()` (aktuelle Rolle, nicht `isActualAdmin()`)

**`TestEmailModal.tsx`** (neu) — Modal mit 5 Buttons, einer pro Mail-Typ:
- Neuer Benutzer registriert
- Konto freigeschaltet
- Konto deaktiviert
- Buchung fehlgeschlagen
- Debug-Stornierung fehlgeschlagen

**`frontend/src/api/adminEmail.ts`** (neu) — `sendTestEmail(type: string): Promise<void>`

## Fehlerbehandlung

- Fehlende Env-Variablen → 503 → Error-Toast im Frontend
- Erfolg → Success-Toast "Test-Mail gesendet an [email]"
- Buttons während des Sendens deaktiviert (Loading-State)

## Dateien

| Datei | Änderung |
|-------|----------|
| `backend/api/admin.py` | Neuer Endpoint `POST /api/admin/test-email` |
| `backend/core/email.py` | Neue Funktion `send_test_email` |
| `frontend/src/components/HamburgerMenu.tsx` | Neuer Menüeintrag |
| `frontend/src/components/TestEmailModal.tsx` | Neue Datei — Modal-Komponente |
| `frontend/src/api/adminEmail.ts` | Neue Datei — API-Funktion |

## Verifikation

1. Backend starten, Frontend starten
2. Als Admin einloggen
3. Hamburger-Menü öffnen → "Test-Mails" sichtbar
4. Als User-Ansicht umschalten → "Test-Mails" verschwindet
5. Zurück zu Admin → "Test-Mails" wieder sichtbar
6. Modal öffnen → 5 Buttons vorhanden
7. Jeden Button klicken → Mail kommt an der Admin-Adresse an
8. Ohne `RESEND_API_KEY` → Error-Toast erscheint
