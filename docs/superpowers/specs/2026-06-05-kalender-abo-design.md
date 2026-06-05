# Design: ICS-Kalender-Abonnement für gebuchte Termine

**Datum:** 2026-06-05  
**Status:** Genehmigt

## Zusammenfassung

Benutzer können ihre bevorstehenden Eversports-Buchungen als ICS-Feed in beliebige Kalender-Apps (Google Calendar, Apple Calendar, Outlook) abonnieren. Der Feed wird dynamisch aus den Live-Daten von Eversports generiert. Wenn eine Buchung über die App storniert wird, verschwindet sie beim nächsten Kalender-Sync automatisch aus dem Kalender.

## Datenmodell

### Migration: `users`-Tabelle

Neues Feld:

```
calendar_token: String, unique, nullable
```

- Wird beim ersten Abruf per `GET /me/calendar-token` erzeugt (UUID4)
- `nullable`, weil bestehende Benutzer zunächst keinen Token haben
- `unique`, damit der Token als Lookup-Schlüssel dient

## Backend

### Neue Endpunkte

#### `GET /me/calendar-token` (JWT-geschützt)

- Gibt `{ "token": "<uuid>" }` zurück
- Erzeugt den Token on-demand, falls er noch nicht existiert (speichert ihn in der DB)
- Response: `200 OK`

#### `POST /me/calendar-token/regenerate` (JWT-geschützt)

- Erzeugt einen neuen UUID4-Token, überschreibt den alten
- Alter Token wird damit ungültig
- Response: `200 OK` mit `{ "token": "<uuid>" }`

#### `GET /calendar/feed.ics?token=<token>` (öffentlich, kein JWT)

- Sucht Benutzer anhand von `calendar_token`; 404 bei unbekanntem Token
- Entschlüsselt das Eversports-Passwort und ruft `fetch_upcoming_bookings` auf
- Bei Fehler (Eversports nicht erreichbar): gibt leeres `VCALENDAR` zurück (Subscription bleibt intakt)
- Response-Header:
  - `Content-Type: text/calendar; charset=utf-8`
  - `Content-Disposition: inline; filename="eversports.ics"`
  - `Cache-Control: no-cache, no-store`

### ICS-Format

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Eversports Bookings//DE
CALSCALE:GREGORIAN
X-WR-CALNAME:Meine Eversports Buchungen
BEGIN:VEVENT
UID:{event_id}@eversports-bookings
DTSTART:{start_datetime in UTC, Format: YYYYMMDDTHHmmssZ}
DTEND:{end_datetime in UTC, Format: YYYYMMDDTHHmmssZ}
SUMMARY:{activity_name}
LOCATION:{facility_name}, {address}
END:VEVENT
...
END:VCALENDAR
```

- `UID` basiert auf `event_id` von Eversports — stabile ID über Syncs hinweg
- Kalender-Apps erkennen anhand der `UID`, welche Events entfernt wurden
- Datetimes werden aus den ISO-Strings der Eversports-API geparst und in UTC konvertiert

### Neue Dateien

- `backend/api/calendar.py` — Router mit den drei Endpunkten
- Alembic-Migration: `calendar_token`-Spalte zu `users`

### Einbindung

In `backend/main.py` wird `calendar.router` eingebunden (kein Auth-Prefix für den Feed-Endpunkt).

## Frontend

### Neues API-Modul

`frontend/src/api/calendar.ts`:

```typescript
getCalendarToken(): Promise<{ token: string }>
regenerateCalendarToken(): Promise<{ token: string }>
```

### Neues Component

`frontend/src/components/CalendarSubscriptionBlock.tsx`:

- Wird im „Gebucht"-Tab unterhalb der Buchungskarten eingeblendet
- Lazy-lädt den Token per `getCalendarToken()` beim ersten Rendern
- Zeigt:
  - Die Abo-URL (`webcal://<host>/api/calendar/feed.ics?token=<token>`)
  - **Kopieren**-Button: kopiert URL in Zwischenablage
  - **In Google Kalender öffnen**-Button: öffnet `https://calendar.google.com/calendar/r?cid=<https-encodierte-URL>`
  - **Token zurücksetzen**-Link: ruft `regenerateCalendarToken()` auf, aktualisiert angezeigte URL

### Einbindung in DashboardPage

Im „Gebucht"-Tab nach der Buchungsliste:

```tsx
{activeTab === 'gebucht' && !bookedLoading && !bookedError && (
  <CalendarSubscriptionBlock />
)}
```

## Sicherheit

- Token = UUID4 (128-bit Entropie) — nicht ratbar
- Kein JWT erforderlich für den Feed → kompatibel mit Kalender-Apps, die keine Auth-Header senden
- Token gibt nur Lesezugriff auf Buchungsdaten, keine Credentials
- Regeneration invalidiert sofort den alten Token

## Nicht im Scope

- Push-Benachrichtigung beim Sync
- Mehrere Kalender-Token pro Benutzer
- Ablaufzeit des Tokens
