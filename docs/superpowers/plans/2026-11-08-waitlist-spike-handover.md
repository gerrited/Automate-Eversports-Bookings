# Handover: Spike Wartelisten-Nachrücken

**Datum:** 2026-11-08
**Branch:** `feature/waitlist-auto-booking`
**Spec:** `docs/superpowers/specs/2026-10-27-waitlist-auto-booking-design.md`

## Ziel

Feature „automatisch von der Warteliste nachrücken“. Vor der Umsetzung muss das echte Eversports-Verhalten geklärt werden (Spike S1–S6 in der Spec). Dieser Spike läuft **lokal**, weil Eversports die Cloud-Session blockiert.

## Stand

### Erledigt
- **Recherche:** Eversports rückt **nicht** automatisch nach. Wird ein Platz frei, bekommen alle Wartenden gleichzeitig eine Push-Nachricht in der App (keine E-Mail). Den Platz bekommt, wer zuerst bucht. Es gibt keine öffentliche API und keine Webhooks.
- **Im Code:** Wartelisten-Beitritt existiert bereits. `book_session()` ruft bei `CartOutcome.SLOT_FULL` `join_waitlist()` auf und gibt `BookingStatus.WAITLIST` zurück. Danach passiert nichts mehr (`WAITLIST` zählt in `BookingStatus.terminal()`).
- **Design-Spec** geschrieben: Tabelle `waitlist_watches`, eigener CronJob alle 2 Minuten, Opt-in pro Job, Cutoff vor Kursbeginn.
- **Untersuchungs-Skript** `scripts/waitlist_probe.py`, offline gegen gemockte Antworten getestet, **noch nie gegen das echte Eversports gelaufen**. Befehle:
  - `introspect`: GraphQL-Introspection auf `/api/checkout` (S5, S6)
  - `calendar --facility X --week D`: Kalender-HTML dumpen, Attribute pro Slot (S4)
  - `profile`: `/u` dumpen, nach Wartelisten-Einträgen suchen (S5)
  - `cart --item UUID`: nur Warenkorb-Mutation, Bestätigung mit `JA` (S1, S3)
  - `watch --facility X --date D --time HH:MM --name N [--book]`: simuliert das Feature (S1, S2, S4). Pollt alle 10 Sekunden Kalender und Warenkorb. Beim ersten freien Platz wird mit `--book` die Order bestätigt. Protokoll: `probe-output/*-watch-*.jsonl`.
  - Rohdaten landen in `probe-output/` (gitignored, enthält persönliche Daten).

### Warum lokal
- Cloudflare beantwortet aus der Cloud-Umgebung alles mit einer Bot-Challenge (403), auch die APIs.
- Einen Headless-Browser gegen die Challenge einzusetzen, wurde als Umgehung eines Bot-Schutzes abgelehnt. **Nicht erneut versuchen.**
- Mit der IP des Nutzers und echtem Login funktioniert der Zugriff, wie der produktive Worker zeigt.
- Nebenbei: In der Cloud wurde eine Umgebung „Automate-Eversports-Bookings“ mit Zugriff auf `www.eversports.de` angelegt. Sie hilft wegen Cloudflare nicht und kann gelöscht werden.

## Nächste Schritte

### 1. Vorab-Checks (nur lesend, mit Konto B)
```bash
pip install -r requirements-backend.txt
python scripts/waitlist_probe.py introspect
python scripts/waitlist_probe.py calendar --facility <slug> --week <Datum des Kurses>
python scripts/waitlist_probe.py profile
```
**Introspect auswerten, bevor der Live-Test läuft:** Gibt es eine eigene Mutation zum Nachrücken oder für die Warteliste (z. B. `bookFromWaitingList`, `removeFromWaitingList`)? Gibt es einen `subscriptionType`? Falls es einen eigenen Weg zum Nachrücken gibt, muss `watch` angepasst werden, sonst ist der einzige Versuch verschenkt.

### 2. Live-Test (nur ein Versuch möglich)
Setup: Konto A hat einen Platz, Konto B setzt sich auf die Warteliste.

Vorher prüfen:
- Konto B hat eine gültige Mitgliedschaft bzw. genug Guthaben.
- Konto A kann noch kostenlos stornieren.
- Andere Wartende können konkurrieren.

Ablauf:
1. Konto B auf die Warteliste (App oder Web).
2. Konto B: `python scripts/waitlist_probe.py watch --facility <slug> --date <JJJJ-MM-TT> --time <HH:MM> --name "<exakt>" --book`
3. Konto B im Browser: eingeloggt, DevTools → Netzwerk, „Preserve log“, WS-Filter. Handy-App mit Push an.
4. Konto A storniert. **Uhrzeit notieren.**
5. **Uhrzeit der Push-Nachricht bei B notieren.**

### 3. Auswerten
| Spike | Quelle | Frage |
|---|---|---|
| S1 | jsonl `cart_ok` / `order_antwort` | Klappt der normale Cart→Order-Ablauf, während man auf der Warteliste steht? |
| S2 | `watch-profile-vorher/nachher.html` | Ist der Wartelisten-Eintrag nach der Buchung weg? |
| S4 | jsonl `slot_markup_geaendert` | Wie markiert der Kalender „voll“ und „frei“? |
| S5 | `introspect`, `profile` | Wartelisten-Einträge auf `/u`? Mutation zum Verlassen? |
| S6 | `introspect` (subscriptionType), DevTools WS | Gibt es einen Live-Kanal statt Polling? |
| Latenz | Uhrzeiten + jsonl | Zeit von Storno A → Push B → unsere Buchung |
| S3 | später `cart --item` auf einen geschlossenen Kurs | Fehlertext bei Buchungsschluss → `CartOutcome.BOOKING_CLOSED` |

### 4. Ergebnisse einarbeiten
- Ergebnisse in die Spec eintragen (Abschnitt „Offene Punkte“) und das Design bei Bedarf anpassen.
- Anonymisierte Ausschnitte als Contract-Fixtures nach `tests/eversports/fixtures/` (keine Namen, E-Mails oder echten IDs).
- Neue Fehler-Keywords nur in `backend/eversports/classify.py`, immer mit Test (siehe CLAUDE.md).
- Danach die Umsetzung nach der Reihenfolge in der Spec.

## Leitplanken (aus CLAUDE.md)
- Eversports-Zugriffe nur in `backend/eversports/`; HTML-Parsing nur in `parsing.py`; Fehlertext-Klassifikation nur in `classify.py`.
- `next_run_at`-Invarianten nicht anfassen. Wartelisten-Watches bekommen einen eigenen `next_check_at`.
- Migrationen mit `op.batch_alter_table()` (SQLite).
- Status nur über Enums (`BookingStatus`, neu `WaitlistStatus`).
