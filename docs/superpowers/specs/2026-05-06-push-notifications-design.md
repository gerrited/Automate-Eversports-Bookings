# Design: Push-Benachrichtigungen vor Terminen

**Datum:** 2026-05-06  
**Status:** Approved

## Übersicht

Nutzer erhalten eine Web-Push-Notification auf ihrem Gerät, wenn ein gebuchter Sportermin in X Minuten beginnt. Die App muss dafür nicht geöffnet sein. Die Vorlaufzeit ist pro Nutzer im Profil einstellbar.

## Architektur

```
App-Start → SW registrieren → Permission anfragen → Push-Subscription ans Backend senden
Worker (alle 15 Min.) → Eversports-Bookings laden → Benachrichtigungsfenster prüfen → Web Push senden
Service Worker im Browser → Push empfangen → OS-Notification anzeigen
```

## Datenmodell

### Neue Tabelle: `push_subscriptions`

| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | String (UUID) | Primary Key |
| `user_id` | String (FK → users) | Besitzer |
| `endpoint` | String (unique) | Push-Endpoint der Subscription |
| `p256dh` | String | Öffentlicher Schlüssel des Clients |
| `auth` | String | Auth-Secret des Clients |
| `created_at` | DateTime | Erstellungszeitpunkt |

Ein User kann mehrere Subscriptions haben (mehrere Geräte).

### Neue Spalte: `users.notification_advance_minutes`

- Typ: Integer, NOT NULL, server_default `60`
- Wer nie Permission erteilt hat, hat keine `push_subscriptions` — der Worker ignoriert diesen User dadurch automatisch

### Neue Umgebungsvariablen

| Variable | Beschreibung |
|---|---|
| `VAPID_PRIVATE_KEY` | Privater VAPID-Schlüssel (einmalig generiert) |
| `VAPID_PUBLIC_KEY` | Öffentlicher VAPID-Schlüssel |
| `VAPID_SUBJECT` | `mailto:`-Adresse für VAPID (z.B. `mailto:admin@example.com`) |

## Backend

### Neue Endpoints

**`GET /api/push/vapid-public-key`** — Kein Auth erforderlich  
Gibt `{ "public_key": "..." }` zurück.

**`POST /api/push/subscribe`** — Auth erforderlich  
Body: `{ "endpoint": "...", "p256dh": "...", "auth": "..." }`  
Legt neue Subscription an oder aktualisiert bestehende anhand des Endpoints.

**`DELETE /api/push/subscribe`** — Auth erforderlich  
Body: `{ "endpoint": "..." }`  
Entfernt Subscription.

### Erweiterung: `GET /api/account`

Gibt zusätzlich `notification_advance_minutes` zurück.

### Erweiterung: `PUT /api/account`

Akzeptiert optionales Feld `notification_advance_minutes` (Integer, min. 15, max. 1440).

### Neue Abhängigkeiten

- `pywebpush` in `requirements-backend.txt` und `requirements-worker.txt`

## Worker

Nach dem bestehenden Booking-Durchlauf wird ein neuer Notification-Block ausgeführt:

1. Alle User laden, die mindestens eine `push_subscription` besitzen
2. Für jeden User: `fetch_upcoming_bookings(email, password)` aufrufen (bestehende Funktion)
3. Für jede Buchung prüfen:
   ```
   now ≤ (start_datetime − advance_minutes) < now + 15min
   ```
4. Trifft es zu: Push-Nachricht via `pywebpush` an alle Subscriptions des Users senden
5. Kommt HTTP `410 Gone` zurück: Subscription aus DB löschen

**Deduplizierung:** Das Sliding-Window `[now, now+15min)` stellt sicher, dass jeder Termin nur einmal in das Fenster fällt — keine separate "bereits gesendet"-Tabelle nötig.

### Notification-Payload

```json
{
  "title": "Termin in 1 Stunde 30 Minuten",
  "body": "Yoga um 09:00 Uhr · FitnessCenter Mitte"
}
```

**Zeitformatierung:**
- 90 min → `"1 Stunde 30 Minuten"`
- 60 min → `"1 Stunde"`
- 30 min → `"30 Minuten"`
- 1 min → `"1 Minute"`

## Frontend

### Service Worker (`frontend/public/sw.js`)

Statische Datei, kein Build-Schritt nötig:
- `push`-Event: JSON-Payload lesen, `showNotification(title, { body })` aufrufen
- `notificationclick`-Event: App-URL öffnen (`clients.openWindow('/')`)

### Hook `usePushNotifications`

Wird in `DashboardPage` beim Laden einmalig aufgerufen:

1. `navigator.serviceWorker.register('/sw.js')`
2. VAPID Public Key von `GET /api/push/vapid-public-key` laden
3. `Notification.requestPermission()` aufrufen
4. Falls `granted`: `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey })` aufrufen
5. Subscription via `POST /api/push/subscribe` ans Backend schicken

Falls Permission `denied`, Browser ohne Support oder API-Fehler: still fehlschlagen, kein UI-Feedback.

### SettingsModal — neuer Abschnitt "Terminerinnerung"

- Lädt `notification_advance_minutes` per `GET /api/account` beim Öffnen
- Zahlenfeld: `Minuten vor dem Termin` (min. 15, max. 1440)
- Speichern-Button → `PUT /api/account`
- Falls `Notification.permission === 'denied'` oder Browser nicht unterstützt: Hinweistext statt Eingabefeld

## Fehlerbehandlung

| Szenario | Verhalten |
|---|---|
| Nutzer verweigert Permission | Kein Fehler, keine Anzeige; keine Subscription wird gespeichert |
| Subscription läuft ab (410) | Worker löscht Subscription aus DB |
| Eversports API nicht erreichbar | Worker loggt Fehler, überspringt Notification-Block für diesen User |
| `pywebpush` Fehler | Worker loggt Fehler, fährt mit nächstem User fort |

## Nicht im Scope

- Opt-out UI (Permission kann über Browser-Einstellungen entzogen werden)
- Notification bei erfolgreicher automatischer Buchung
- Notification-History im Frontend
