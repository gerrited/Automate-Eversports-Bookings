# ADR-004: Worker-Zeitplanung und Idempotenz

**Datum:** 2026-04-11  
**Status:** Akzeptiert

## Kontext

Buchungen müssen eine konfigurierbare Anzahl von Tagen vor dem Kurs ausgelöst werden. Das Buchungsfenster bei Eversports öffnet sich typischerweise genau N Tage im Voraus. Der Worker muss häufig genug laufen, um das Fenster nicht zu verpassen, darf aber Buchungen niemals doppelt durchführen.

## Entscheidung

### Zeitplan

Der Worker läuft als Kubernetes CronJob alle 15 Minuten (`*/15 * * * *`, `timeZone: Europe/Berlin`). `concurrencyPolicy: Forbid` verhindert parallele Ausführungen.

### Fälligkeitsberechnung

Für jede aktive Buchung berechnet der Worker:

```
target_date = today + days_in_advance
due = (target_date.weekday() == job.weekday)
```

Eine Buchung mit `weekday=1` (Dienstag) und `days_in_advance=4` ist freitags fällig: Freitag + 4 Tage = Dienstag.

### Idempotenz

Vor jeder Buchungsausführung prüft der Worker `booking_logs` auf einen bestehenden Eintrag mit:
- `job_id = job.id`
- `target_date = target_date`
- `status = 'success'`

Existiert eine solche Zeile, wird die Buchung übersprungen. Damit ist der Worker sicher neu startbar — ein Absturz nach einer erfolgreichen Buchung führt beim nächsten Lauf nicht zu einer Doppelbuchung.

### Fehlerisolierung

Eine Exception in einer Buchung bricht den Worker nicht ab. Jede Buchung ist in einem `try/except` gekapselt; Fehler werden als `booking_logs`-Eintrag mit `status='failed'` und Fehlermeldung gespeichert, danach läuft der Worker mit der nächsten Buchung weiter.

## Konsequenzen

- Eine durchgeführte Buchung wird bei jedem Folgelauf erkannt und übersprungen. Keine Doppelbuchungen.
- Ist die Eversports-API kurzzeitig nicht erreichbar, versucht der nächste Lauf (15 Minuten später) automatisch erneut (der fehlgeschlagene Log-Eintrag hat `status='failed'`, nicht `'success'`, sodass die Idempotenz-Prüfung den Retry nicht blockiert).
- Der Worker benötigt Zugriff auf die Secrets `DATABASE_URL` und `ENCRYPTION_KEY` — er braucht weder `JWT_SECRET` noch `FRONTEND_URL`.
- Manueller Trigger zum Testen: `kubectl create job --from=cronjob/eversports-worker worker-test-run`.
