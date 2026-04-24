# Design: "Gebucht"-Tab — tatsächlich gebuchte Eversports-Termine

**Datum:** 2026-04-24

## Zusammenfassung

Der bestehende "Buchungen"-Tab wird in "Geplant" umbenannt (zeigt weiterhin `booking_jobs`). Ein neuer "Gebucht"-Tab zeigt alle zukünftigen Buchungen direkt vom Eversports-Konto des Benutzers — unabhängig davon, ob sie über diese App oder anderweitig erstellt wurden. Buchungen können aus dem Tab heraus storniert werden.

## Datenquelle

Eversports bietet keine verwendbare GraphQL-API für gebuchte Termine (alle getesteten Queries schlugen fehl). Die Seite `https://www.eversports.de/u` liefert die Daten als serverseitig gerendertes HTML. Jede Buchung erscheint als `div.marketplace-booked-activity` mit allen nötigen Feldern.

Gewählter Ansatz: HTML-Scraping von `/u` mit der authentifizierten `requests`-Session (identisches Muster wie `cancel_booking()`).

## Backend

### Neue Funktion: `fetch_upcoming_bookings(email, password)` in `backend/core/booking.py`

1. `eversports_login(email, password)` → Session
2. `GET https://www.eversports.de/u`
3. Parse alle `div.marketplace-booked-activity`
4. Gib Liste zurück

Rückgabe-Schema pro Buchung:
```python
{
  "activity_name": str,          # h4.marketplace-booked-activity__name
  "facility_name": str,          # div.marketplace-booked-activity__facility a
  "facility_slug": str,          # aus href="/s/<slug>"
  "start_datetime": str,         # ISO 8601, aus hidden input #google-calendar-start
  "end_datetime": str,           # ISO 8601, aus hidden input #google-calendar-end
  "address": str,                # street + zip + city aus hidden inputs
  "event_id": str,               # data-event auf cancel-link-event
  "event_participant_id": str,   # data-eventparticipant
  "session_id": str,             # data-session
  "facility_id": str,            # data-facilityid
}
```

### Neue Funktion: `cancel_booking_by_ids(email, password, event_id, event_participant_id, facility_id, session_id)` in `backend/core/booking.py`

Ruft direkt `POST https://www.eversports.de/api/event/cancel` mit den übergebenen IDs auf. Kein erneutes Scrapen der `/u`-Seite nötig.

### Neuer Router: `backend/api/bookings.py`

```
GET  /api/bookings/upcoming
POST /api/bookings/{event_participant_id}/cancel
```

Beide Endpunkte:
- JWT-Auth (identisch zu `jobs.py`)
- Credentials entschlüsseln: `decrypt(current_user.encrypted_password)`
- Fehlerbehandlung: Login-Fehler → HTTP 502, Stornierungsfehler → HTTP 400 mit Eversports-Fehlermeldung

Router wird in `backend/main.py` eingehängt.

## Frontend

### Tab-Umbenennung

In `frontend/src/pages/DashboardPage.tsx`:
- Tab-Label "Buchungen" → "Geplant"
- Neuer Tab "Gebucht" mit Hash `#booked`
- Tab-Typ: `'geplant' | 'gebucht' | 'benutzer' | 'jobs'`

### Neue API-Datei: `frontend/src/api/bookedAppointments.ts`

```typescript
getUpcomingBookings(): Promise<BookedAppointment[]>
cancelBooking(eventParticipantId: string, ids: CancelIds): Promise<void>
```

### Neuer Typ in `frontend/src/types.ts`

```typescript
interface BookedAppointment {
  activity_name: string;
  facility_name: string;
  facility_slug: string;
  start_datetime: string;
  end_datetime: string;
  address: string;
  event_id: string;
  event_participant_id: string;
  session_id: string;
  facility_id: string;
}
```

### Neue Komponente: `BookedAppointmentCard`

Zeigt pro Buchung:
- Wochentag + Datum + Uhrzeit (Start–Ende)
- Kursname (fett)
- Studio-Name + Adresse
- "Stornieren"-Button → öffnet Bestätigungsdialog → ruft Cancel-Endpunkt auf → entfernt Buchung aus Liste

Analog zu `JobCard` in Struktur und Styling.

### Tab-Inhalt "Gebucht"

- Lädt Daten beim ersten Aktivieren des Tabs (lazy)
- Loading-Spinner während Fetch
- Fehlermeldung bei HTTP 5xx
- "Keine bevorstehenden Buchungen" bei leerem Array

## Fehlerbehandlung

| Szenario | Verhalten |
|---|---|
| Login schlägt fehl | HTTP 502 → Frontend zeigt Fehlerbanner im Tab |
| `/u` nicht erreichbar | HTTP 502 → gleiche Anzeige |
| Stornierung fehlgeschlagen | HTTP 400 + Eversports-Meldung → Toast-Benachrichtigung |
| Leere Buchungsliste | `[]` → "Keine bevorstehenden Buchungen" |

## Nicht im Scope

- Caching der Buchungsdaten
- Vergangene Buchungen anzeigen
- Wartelisten-Einträge gesondert kennzeichnen
