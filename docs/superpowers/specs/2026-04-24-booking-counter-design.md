# Design: Buchungszähler pro User

**Datum:** 2026-04-24

## Überblick

Unterhalb der Liste der geplanten Buchungen (Job-Cards) wird für jeden User angezeigt, wie viele Buchungen der Worker bisher automatisch durchgeführt hat. Der Zähler sitzt als Feld direkt am User-Modell.

## Datenbank

Neues Feld am `User`-Modell:

```python
total_bookings_executed: int = Field(default=0, nullable=False)
```

Neue Alembic-Migration setzt den Default-Wert für alle bestehenden User auf 0. Keine Rückbefüllung aus historischen `BookingLog`-Einträgen — der Zähler startet mit dem Deployment bei 0.

## Worker

Nach dem Schreiben eines `BookingLog`-Eintrags wird der Zähler inkrementiert, wenn der Status `success`, `already_booked` oder `waitlist` ist:

```python
if log_entry.status in ("success", "already_booked", "waitlist"):
    user.total_bookings_executed += 1
```

Das Update erfolgt in derselben DB-Session wie der Log-Eintrag (atomar).

## Backend-API

Das Feld `total_bookings_executed` wird im bestehenden `/me`-Endpoint als Teil des User-Objekts zurückgegeben. Kein neuer Endpoint erforderlich.

## Frontend

Unterhalb der Job-Cards-Liste wird die Meldung angezeigt, sobald `total_bookings_executed > 0`:

- **Singular** (`= 1`): „🦾 für dich wurde bereits **1** Buchung automatisch durchgeführt."
- **Plural** (`> 1`): „🦾 für dich wurden bereits **X** Buchungen automatisch durchgeführt."
- **Bei 0**: Meldung wird nicht angezeigt.

Der Wert stammt aus dem bereits geladenen User-Objekt — kein zusätzlicher API-Call.
