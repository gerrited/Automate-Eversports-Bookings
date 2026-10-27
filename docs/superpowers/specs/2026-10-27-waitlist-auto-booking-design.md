# Design: Automatisches Nachrücken von der Warteliste

**Datum:** 2026-10-27
**Status:** Entwurf (Plan, noch nicht umgesetzt)

## Überblick

Heute landet ein Job, dessen Kurs ausgebucht ist, automatisch auf der Eversports-Warteliste (`BookingStatus.WAITLIST`, siehe `book_session()` in `backend/eversports/client.py`). Danach passiert nichts mehr: Der Slot gilt als erledigt (`BookingStatus.terminal()`), `next_run_at` wird weitergeschaltet.

Ziel: Solange der Nutzer auf der Warteliste steht, prüft das System regelmäßig, ob ein Platz frei geworden ist, und bucht ihn dann automatisch.

## Recherche: Wie die Eversports-Warteliste funktioniert

Quelle: Eversports-Manager-Hilfecenter („How to use the waiting list“, „How can I see if a customer is on the waiting list“).

- Die Warteliste entsteht automatisch, sobald eine Aktivität ausgebucht ist.
- Wird ein Platz frei, bekommen **alle** Wartenden gleichzeitig eine Push-Nachricht in der Eversports-App. **Es gibt keine E-Mail.**
- **Kein automatisches Nachrücken:** Wer nach der Push-Nachricht nicht selbst bucht, wird nicht eingetragen.
- Vergabe nach **„first come, first served“**: Wer zuerst bucht, bekommt den Platz.

Konsequenzen für das Design:

1. „Nachrücken“ heißt für uns: **normal buchen, sobald wieder ein Platz frei ist.** Das ist derselbe Cart→Order-Flow wie heute. Eine spezielle Mutation braucht es dafür nicht.
2. Wir bekommen keine Push-Nachricht von Eversports. Freie Plätze erkennen wir also nur per **Polling**.
3. Bei Windhund-Vergabe entscheidet die **Polling-Frequenz** über die Erfolgsquote. Der bestehende 15-Minuten-Takt ist dafür zu langsam: Menschen mit Push-Nachricht sind fast immer schneller.

### Offene Punkte, die nur mit einem echten Account geklärt werden können

Diese Umgebung erreicht `eversports.de` nicht. Deshalb gibt es vor der Umsetzung einen **Spike**: Im Browser einen HAR-Mitschnitt eines ausgebuchten Kurses und einer Wartelisten-Session aufnehmen.

| # | Frage | Warum relevant |
|---|---|---|
| S1 | Funktioniert `createCartFromEventBookableItem` für einen wieder freien Platz, solange man auf der Warteliste steht? Oder ist der Platz für Wartende reserviert, bzw. ist ein anderer Flow nötig? | Kernannahme des Designs |
| S2 | Entfernt Eversports den Wartelisten-Eintrag nach erfolgreicher Buchung automatisch? | Aufräumen |
| S3 | Welcher Fehlertext kommt, wenn die Buchung geschlossen ist (Buchungsschluss vor Kursbeginn)? | neues `CartOutcome.BOOKING_CLOSED` in `classify.py` |
| S4 | Zeigt das Kalender-HTML (`/api/eventsession/calendar`) freie Plätze bzw. „ausgebucht“ an? | billige Verfügbarkeitsprüfung ohne Cart-Mutation (Optimierung, Phase 2) |
| S5 | Erscheinen Wartelisten-Einträge auf `/u`, und mit welchem Markup? Wie heißt die Mutation zum Verlassen der Warteliste? | manuell (in der App) gesetzte Wartelisten-Einträge erkennen, Warteliste verlassen (Phase 2) |
| S6 | Nutzt die Eversports-Website einen Echtzeit-Kanal (WebSocket, GraphQL-Subscription, Server-Sent Events) oder eine Benachrichtigungs-Liste, die „Platz frei“ meldet? Im HAR bzw. in den DevTools nach `ws://`/`wss://`-Verbindungen, `subscription`-Operationen und Notification-Queries suchen, während ein Platz frei wird. | Würde das Polling durch ein Event ersetzen. Öffentliche Webhooks gibt es laut Recherche nicht, der App-Push (an registrierte Geräte) ist für das Backend nicht abonnierbar. |

Die Ergebnisse von S3 bis S5 werden als Contract-Fixtures in `tests/eversports/fixtures/` abgelegt.

## Datenmodell

Neue Tabelle `waitlist_watches`. Sie ist bewusst getrennt von `booking_jobs`: Ein Job ist eine wiederkehrende Regel, ein Watch ist ein konkreter Termin. Die Invariante „ein Slot wird genau einmal versucht“ für `next_run_at` bleibt so unberührt.

| Spalte | Typ | Beschreibung |
|---|---|---|
| `id` | TEXT PK | UUID |
| `job_id` | TEXT FK → booking_jobs, `ON DELETE CASCADE`, nullable | auslösender Job (NULL für spätere manuelle Watches) |
| `user_id` | TEXT FK → users | |
| `bookable_item_id` | TEXT | `data-uuid` des Slots: Mit ihm buchen wir direkt, ohne den Kalender erneut zu parsen |
| `target_date` | DATE | Kurstag |
| `class_start` | TIMESTAMPTZ | Kursbeginn (UTC) |
| `book_until` | TIMESTAMPTZ | letzter Zeitpunkt für einen Buchungsversuch = `class_start - waitlist_cutoff_minutes` |
| `status` | TEXT | `WaitlistStatus`: `watching` / `booked` / `expired` / `cancelled` / `failed` |
| `next_check_at` | TIMESTAMPTZ, Index | nächste Prüfung (UTC) |
| `last_checked_at` | TIMESTAMPTZ | |
| `consecutive_errors` | INT | unbekannte Fehler in Folge; ab Schwelle wird der Watch `failed` |
| `created_at` | TIMESTAMPTZ | |

Dazu ein Unique-Constraint `(job_id, target_date)`, damit ein Termin nie doppelt beobachtet wird.

Neue Felder an `booking_jobs`:

- `waitlist_auto_book: bool` (Default `false`, opt-in): Das späte Nachrücken kann Stornogebühren oder No-Show-Strafen nach sich ziehen, wenn der Nutzer kurzfristig nicht kann.
- `waitlist_cutoff_minutes: int` (Default 120): bis wie kurz vor Kursbeginn noch gebucht wird.

`WaitlistStatus` wird analog zu `BookingStatus` als `StrEnum` in `backend/core/status.py` angelegt, nie als freier String.

Die Migration verwendet `op.batch_alter_table()` für die neuen `booking_jobs`-Spalten (SQLite-Kompatibilität, siehe `b2c3d4e5f6a7`).

## Eversports-Schicht (`backend/eversports/`)

- `client.py`: Den Cart→Order-Teil aus `book_session()` herauslösen in `book_item(session, bookable_item_id) -> dict`. Er liefert dasselbe Status-Dict, tritt aber bei `SLOT_FULL` **nicht** der Warteliste bei, sondern meldet `BookingStatus.WAITLIST` bzw. ein neues Ergebnis „noch voll“. `book_session()` nutzt `book_item()` intern und gibt zusätzlich `bookable_item_id` zurück.
- `classify.py`: neues `CartOutcome.BOOKING_CLOSED` (Keywords aus Spike S3), inklusive Test.
- Ein Login pro Nutzer und Lauf: Watches werden nach `user_id` gruppiert und teilen sich eine `requests.Session`. Das schont Rate-Limits und Cloudflare.

## Worker

### Watch anlegen

In `process_job()`: Ist `result["status"] == BookingStatus.WAITLIST` und `job.waitlist_auto_book` gesetzt, wird in derselben Transaktion wie der `BookingLog` ein `WaitlistWatch(status=watching, next_check_at=now)` angelegt. `next_run_at` wird wie bisher weitergeschaltet, an der Scheduling-Invariante ändert sich nichts.

### Watches prüfen: neues Modul `worker/waitlist.py`

```
fällig = status == watching AND next_check_at <= now
Claim per FOR UPDATE SKIP LOCKED (wie process_job)
if now >= book_until:              → expired, Mail „nicht nachgerückt“
result = book_item(session, bookable_item_id)
  SUCCESS        → booked; BookingLog(status=SUCCESS, message="<order_id> (Warteliste)");
                   Mail + Push „Platz von Warteliste gebucht“; debug → stornieren wie heute
  ALREADY_BOOKED → booked (Nutzer hat selbst gebucht), keine Mail
  SLOT_FULL      → next_check_at = now + intervall
  BOOKING_CLOSED → expired
  Fehler         → consecutive_errors += 1; ab 5 → failed + Mail; sonst nächster Check
```

- `total_bookings_executed` wird beim Nachrücken **nicht** erneut erhöht: Der `waitlist`-Log hat bereits gezählt.
- Ein `one_time`-Job wird nach `booked` bzw. `expired` gelöscht. Heute bleibt er bei `waitlist` stehen.
- Deaktiviert oder löscht der Nutzer den Job, gehen seine Watches auf `cancelled` (Löschen per Cascade, Deaktivieren in `backend/api/jobs.py`).

### Polling-Takt

Die Windhund-Vergabe macht das zur wichtigsten Stellschraube.

- **Eigener CronJob** `eversports-waitlist` mit `*/2 * * * *`, `concurrencyPolicy: Forbid`, selbes Image, Entrypoint `python -m worker.waitlist`. Der Buchungs-Worker bleibt bei 15 Minuten.
- Intervall pro Watch: 2 Minuten. Das ist erweiterbar, z. B. dichter im Zeitraum vor der kostenfreien Stornofrist des Studios, weil dort die meisten Plätze frei werden.
- Lastabschätzung: ein Login plus eine Mutation pro Nutzer mit aktivem Watch alle 2 Minuten. Bei wenigen Nutzern unkritisch. Trotzdem gibt es ein Limit für aktive Watches pro Nutzer, z. B. 5, um eine Account-Sperre durch Eversports zu vermeiden.

**Phase 2 (nach Spike S4):** Erst das Kalender-HTML lesen. Nur wenn der Slot nicht als „ausgebucht“ markiert ist, wird die Cart-Mutation ausgelöst. Das spart Mutationen und wirkt weniger auffällig.

## API

- `JobCreate`/`JobUpdate`/`JobResponse`: `waitlist_auto_book` und `waitlist_cutoff_minutes` ergänzen. Das sind keine Scheduling-Felder, also keine Neuberechnung von `next_run_at`.
- `GET /api/jobs/{id}/waitlist`: aktive und letzte Watches eines Jobs.
- `DELETE /api/waitlist/{id}`: Watch beenden (`cancelled`).
- `POST /api/jobs/{id}/execute` (manuelle Ausführung) legt bei `WAITLIST` ebenfalls einen Watch an.
- Admin-Statistik (`backend/api/admin.py`): `waitlist_count` und `waitlist_booked_count`.

## Frontend

- Job-Formular: Toggle „Von Warteliste automatisch nachrücken“ mit Cutoff-Auswahl (30 min / 1 h / 2 h / 6 h / 24 h) und Hinweis auf Stornogebühren.
- Job-Card: Badge „⏳ Warteliste – prüfe bis Di 16:00“ für einen aktiven Watch, mit Abbrechen-Button.
- `LogDrawer`/`statusLabels.ts`: Erfolgs-Log mit Zusatz „(von Warteliste)“.

## E-Mails / Push

- Neu `worker/templates/email/waitlist_booked.html`: „Platz von der Warteliste gebucht“.
- Neu `worker/templates/email/waitlist_expired.html`: „Nicht nachgerückt“ (optional, abschaltbar).
- Push über die bestehende Infrastruktur (`backend/core/push.py`) bei erfolgreichem Nachrücken. Das ist der wichtigste Kanal, weil eine kurzfristige Buchung schnell bemerkt werden muss.
- Die CLAUDE.md-Tabelle der E-Mail-Templates wird ergänzt.

## Tests

- `tests/eversports/test_classify.py`: `BOOKING_CLOSED`-Keywords.
- `tests/eversports/test_client.py`: `book_item()` mit Erfolg, voll, geschlossen und kostenloser Session; `book_session()` liefert `bookable_item_id`.
- `tests/worker/test_waitlist.py`: alle Zustandsübergänge, Cutoff, Fehlerschwelle, Session-Reuse pro Nutzer, Debug-Storno, Löschung von `one_time`-Jobs, kein doppelter Zähler. SKIP LOCKED läuft in der CI gegen PostgreSQL.
- `tests/worker/test_worker.py`: Ein Watch wird nur mit `waitlist_auto_book` angelegt.
- API-Tests für die neuen Felder und Endpunkte, Frontend-Tests für Toggle und Badge.

## Umsetzungsreihenfolge

1. **Spike** S1 bis S3 mit echtem Account (HAR), Fixtures ablegen.
2. Eversports-Schicht: `book_item()`, `BOOKING_CLOSED`, Tests.
3. Modell, Migration und `WaitlistStatus`.
4. `worker/waitlist.py` mit Tests; Watch-Anlage in `process_job()`.
5. k8s-CronJob `eversports-waitlist`.
6. API-Felder und -Endpunkte, E-Mail und Push.
7. Frontend.
8. Phase 2: Verfügbarkeit aus dem Kalender-HTML (S4), manuelle Wartelisten-Einträge von `/u` erkennen (S5), Polling durch einen Echtzeit-Kanal ersetzen, falls S6 einen findet.

## Risiken

- **Erfolgsquote:** Nutzer mit App-Push sind schneller. Ein 2-Minuten-Polling erhöht die Chance, garantiert aber nichts.
- **Kurzfristige Buchungen:** Gebühren für späte Stornos oder No-Shows. Dagegen helfen Opt-in, Cutoff und sofortiger Push.
- **Account-Sperre durch häufige Logins:** Dagegen helfen Session-Reuse, ein Watch-Limit und in Phase 2 die Kalender-Vorprüfung.
- **Annahme S1** muss vor der Umsetzung bestätigt sein.
