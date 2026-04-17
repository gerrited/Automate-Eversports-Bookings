# Design: Einmalige Jobs

**Datum:** 2026-04-17

## Übersicht

Jobs können als "einmalig" markiert werden. Nach erfolgreicher Ausführung werden sie automatisch gelöscht. Der Default ist ein dauerhafter Job. Bei fehlgeschlagener Ausführung bleibt der Job bestehen und wird beim nächsten fälligen Termin erneut versucht.

---

## Datenmodell

**Datei:** `backend/models/booking_job.py`

Neue Spalte:

```python
one_time = Column(Boolean, default=False, nullable=False)
```

**Alembic-Migration:** Neue Versionsdatei unter `backend/alembic/versions/`. Fügt `one_time` mit `server_default='false'` hinzu. Bestehende Jobs sind damit automatisch dauerhaft.

---

## Schemas

**Datei:** `backend/schemas/job.py`

- `JobCreate`: `one_time: bool = False`
- `JobUpdate`: `one_time: Optional[bool] = None`
- `JobResponse`: `one_time: bool`

---

## Worker-Logik

**Datei:** `worker/worker.py`

Nach dem Schreiben des Log-Eintrags in `run()`:

- Wenn `job.one_time is True` und `log_entry.status in ("success", "already_booked")`: Job löschen.
- Wenn `log_entry.status == "failed"`: Job bleibt bestehen.

Der Löschvorgang erfolgt im selben DB-Commit wie der Log-Eintrag — dadurch gibt es keinen inkonsistenten Zustand (Job weg, aber kein Log).

---

## API

Keine neuen Endpoints. Die bestehenden Endpoints `POST /jobs` und `PUT /jobs/{job_id}` werden durch die Schema-Erweiterung automatisch unterstützt. `JobResponse` gibt `one_time` zurück.

---

## Frontend

### JobModal (`frontend/src/components/JobModal.tsx`)

- Neuer State: `oneTime: boolean`, Default `false`
- Checkbox unterhalb der bestehenden Felder:
  - Label: "Einmalige Buchung (wird nach Ausführung gelöscht)"
  - Beim Bearbeiten eines bestehenden Jobs: initialisiert mit `job.one_time ?? false`
- `one_time` wird in `JobFormData` und im `onSave`-Aufruf mitgegeben

### JobCard (`frontend/src/components/JobCard.tsx`)

- Einmalige Jobs erhalten ein kleines Badge/Label (z.B. "Einmalig"), damit sie auf einen Blick erkennbar sind.

### Types (`frontend/src/types.ts`)

- `Job`: `one_time: boolean` hinzufügen
- `JobFormData`: `one_time: boolean` hinzufügen

---

## Duplikat-Prüfung

Die bestehende Duplikat-Prüfung in `backend/api/jobs.py` bleibt unverändert. Sie verhindert identische Jobs anhand von Wochentag, Uhrzeit, Einrichtung und Kursname — unabhängig von `one_time`. Ein einmaliger und ein dauerhafter Job mit denselben Feldern gelten als Duplikat.

---

## Tests

- `tests/worker/test_worker.py`: Testfälle für das Löschen nach `success` und `already_booked`, sowie das Beibehalten bei `failed`.
- `tests/backend/test_api_jobs.py`: `one_time` in Create/Update/Response-Assertions ergänzen.
- `frontend/src/components/JobModal.test.tsx`: Checkbox rendern und Wert übergeben.
