# Metriken & Alerting — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Der Wert des Systems ist „verlässlich buchen, wenn das Fenster öffnet" — aber heute erfährt niemand, wenn der Worker still ausfällt oder die Erfolgsrate einbricht. Drei Bausteine: (1) jeder Worker-Lauf wird in der DB protokolliert, (2) ein Admin-Endpoint zeigt Lauf-Historie, Erfolgsrate und ein „Worker stale"-Flag, (3) der Worker alarmiert Admins per E-Mail, wenn er eine Lücke seit dem letzten Lauf entdeckt; optional Sentry für unbehandelte Exceptions.

**Architecture:** Tabelle `worker_runs` als Quelle der Wahrheit (funktioniert mit der bestehenden Infra: CronJob-Worker kann nicht von Prometheus gescrapt werden, und ein Pushgateway wäre neue Infrastruktur — bewusst DB-basiert). `process_job` gibt seinen finalen Status zurück; `run()` aggregiert und persistiert. Backend liest nur. Sentry ist ein optionaler 5-Zeilen-Hook hinter `SENTRY_DSN`.

**Tech Stack:** SQLAlchemy, Alembic, bestehende Resend-E-Mail-Infrastruktur (`worker/email.py`), optional `sentry-sdk`.

**Voraussetzung:** PR #18 gemerged. `down_revision` der Migration vor Ausführung per `alembic heads` prüfen (erwartet `c8d9e0f1a2b3`; falls der Refresh-Rotation-Plan zuerst lief: `d4e5f6a7b8c9`).

---

## File Structure

| Datei | Verantwortung |
|---|---|
| `backend/models/worker_run.py` | Modell `worker_runs` |
| `backend/alembic/versions/e5f6a7b8c9d0_add_worker_runs.py` | Migration |
| `worker/worker.py` | Status-Rückgabe aus `process_job`, Lauf-Protokoll, Lücken-Alarm |
| `worker/templates/email/worker_gap_alert.html` | Alarm-Template |
| `worker/email.py` | `send_worker_gap_alert()` |
| `backend/api/admin.py` | `GET /api/admin/metrics` |
| `backend/main.py` + `worker/worker.py` | optionaler Sentry-Init |
| `tests/worker/test_worker_runs.py`, `tests/backend/test_api_admin_metrics.py` | Tests |

---

### Task 1: Modell + Migration

**Files:**
- Create: `backend/models/worker_run.py`
- Modify: `backend/models/__init__.py` (Import ergänzen)
- Create: `backend/alembic/versions/e5f6a7b8c9d0_add_worker_runs.py`

- [ ] **Step 1: Modell**

```python
# backend/models/worker_run.py
import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, Integer, String

from backend.db import Base


class WorkerRun(Base):
    __tablename__ = "worker_runs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    started_at = Column(DateTime(timezone=True), nullable=False, index=True)
    finished_at = Column(DateTime(timezone=True), nullable=False)
    jobs_due = Column(Integer, nullable=False, default=0)
    succeeded = Column(Integer, nullable=False, default=0)
    failed = Column(Integer, nullable=False, default=0)
    waitlisted = Column(Integer, nullable=False, default=0)
```

- [ ] **Step 2: Migration** (Muster identisch zur `refresh_tokens`-Migration; `down_revision` per `alembic heads` ermitteln)

```python
# backend/alembic/versions/e5f6a7b8c9d0_add_worker_runs.py
"""add worker_runs table"""
import sqlalchemy as sa
from alembic import op

revision = "e5f6a7b8c9d0"
down_revision = "c8d9e0f1a2b3"  # vor Ausführung gegen `alembic heads` prüfen!
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "worker_runs",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("jobs_due", sa.Integer(), nullable=False),
        sa.Column("succeeded", sa.Integer(), nullable=False),
        sa.Column("failed", sa.Integer(), nullable=False),
        sa.Column("waitlisted", sa.Integer(), nullable=False),
    )
    op.create_index("ix_worker_runs_started_at", "worker_runs", ["started_at"])


def downgrade() -> None:
    op.drop_table("worker_runs")
```

- [ ] **Step 3: Anwenden + Commit**

Run: `DATABASE_URL=sqlite:///eversports.db venv/bin/alembic -c backend/alembic.ini upgrade head`

```bash
git add backend/models/ backend/alembic/versions/e5f6a7b8c9d0_add_worker_runs.py
git commit -m "feat(metrics): worker_runs-Tabelle"
```

---

### Task 2: process_job gibt Status zurück, run() protokolliert

**Files:**
- Modify: `worker/worker.py` — `process_job` (gibt `str | None` zurück), `run()` (sammelt + persistiert)
- Test: `tests/worker/test_worker_runs.py`

- [ ] **Step 1: Failing Tests schreiben**

```python
# tests/worker/test_worker_runs.py
from datetime import datetime

from backend.models.worker_run import WorkerRun
from tests.worker.test_worker import _job, _user  # bestehende Helper wiederverwenden
from worker.worker import run


def test_run_protokolliert_lauf_mit_zaehlern(db_session, session_factory, mocker):
    _user(db_session, uid="m1", ev="ev_m1", email="m1@b.com")
    _user(db_session, uid="m2", ev="ev_m2", email="m2@b.com")
    _job(db_session, jid="jm1", uid="m1")
    _job(db_session, jid="jm2", uid="m2")

    mocker.patch("worker.worker.decrypt", return_value="pass")
    def book_by_email(**kwargs):
        if kwargs["email"] == "m1@b.com":
            return {"status": "success", "order_id": "o1"}
        raise RuntimeError("kaputt")
    mocker.patch("worker.worker.book_session", side_effect=book_by_email)
    mocker.patch("worker.worker.send_booking_failure_email")

    run(datetime(2026, 4, 10, 18, 0), session_factory)

    runs = db_session.query(WorkerRun).all()
    assert len(runs) == 1
    assert runs[0].jobs_due == 2
    assert runs[0].succeeded == 1
    assert runs[0].failed == 1
    assert runs[0].waitlisted == 0
    assert runs[0].finished_at >= runs[0].started_at


def test_run_ohne_faellige_jobs_protokolliert_trotzdem(db_session, session_factory):
    run(datetime(2026, 4, 10, 18, 0), session_factory)
    runs = db_session.query(WorkerRun).all()
    assert len(runs) == 1
    assert runs[0].jobs_due == 0
```

- [ ] **Step 2: Fehlschlag verifizieren**

Run: `venv/bin/pytest tests/worker/test_worker_runs.py -v`
Expected: FAIL (`WorkerRun`-Query leer)

- [ ] **Step 3: Implementierung**

`process_job` (worker/worker.py): alle `return`-Pfade geben einen Status zurück —
Claim fehlgeschlagen/Zukunft/NULL-Init: `return None`; „verpasst": `return str(BookingStatus.FAILED)`; already_booked-Skip: `return str(BookingStatus.ALREADY_BOOKED)`; regulärer Abschluss: `return str(log_entry.status)`.

`run()`: um Protokollierung ergänzen —

```python
def run(now: datetime, session_factory=None) -> None:
    ...bestehender Code bis ThreadPool...
    started_at = datetime.now(timezone.utc)
    counts = {"success": 0, "failed": 0, "waitlist": 0}
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
        futures = {executor.submit(process_job, jid, now, session_factory, admin_emails): jid for jid in due_job_ids}
        for future in as_completed(futures):
            try:
                status = future.result()
                if status in counts:
                    counts[status] += 1
            except Exception as exc:
                counts["failed"] += 1
                log.error("Job %s: unhandled thread error — %s", futures[future], exc)

    _record_run(session_factory, started_at, len(due_job_ids), counts)
    _run_push_notifications(now, session_factory)


def _record_run(session_factory, started_at, jobs_due: int, counts: dict) -> None:
    from backend.models.worker_run import WorkerRun
    db = session_factory()
    try:
        db.add(WorkerRun(
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            jobs_due=jobs_due,
            succeeded=counts["success"],
            failed=counts["failed"],
            waitlisted=counts["waitlist"],
        ))
        db.commit()
    except Exception as exc:
        log.error("Worker-Lauf konnte nicht protokolliert werden: %s", exc)
    finally:
        db.close()
```

(`already_booked` zählt bewusst nicht als Erfolg und nicht als Fehler — es ist ein No-op.)

- [ ] **Step 4: Gesamtsuite + Commit**

Run: `venv/bin/pytest tests/ -q` — Expected: alle passed (bestehende Worker-Tests prüfen `process_job`-Seiteneffekte, nicht den Rückgabewert — bleiben grün)

```bash
git add worker/worker.py tests/worker/test_worker_runs.py
git commit -m "feat(metrics): jeder Worker-Lauf wird mit Zählern protokolliert"
```

---

### Task 3: Lücken-Alarm — Worker erkennt eigenen Ausfall nachträglich

Der Worker kann nicht melden, dass er gerade NICHT läuft — aber der nächste Lauf kann die Lücke sehen: Liegt der letzte protokollierte Lauf mehr als 60 Minuten zurück (4 verpasste 15-Minuten-Slots), geht eine Admin-Mail raus.

**Files:**
- Modify: `worker/worker.py`
- Create: `worker/templates/email/worker_gap_alert.html`
- Modify: `worker/email.py`
- Test: `tests/worker/test_worker_runs.py` (ergänzen)

- [ ] **Step 1: Failing Tests**

```python
# tests/worker/test_worker_runs.py — ergänzen
from datetime import timedelta, timezone as tz


def _vorheriger_lauf(db, minuten_zurueck: int):
    from datetime import datetime as dt
    t = dt.now(tz.utc) - timedelta(minutes=minuten_zurueck)
    db.add(WorkerRun(started_at=t, finished_at=t, jobs_due=0, succeeded=0, failed=0, waitlisted=0))
    db.commit()


def test_luecke_ueber_60_min_alarmiert_admins(db_session, session_factory, mocker):
    from backend.models.user import User
    db_session.add(User(id="adm", eversports_user_id="ev_adm", email="adm@b.com",
                        encrypted_password="x", active=True, role="admin"))
    db_session.commit()
    _vorheriger_lauf(db_session, minuten_zurueck=90)
    mock_alert = mocker.patch("worker.worker.send_worker_gap_alert")

    run(datetime(2026, 4, 10, 18, 0), session_factory)

    mock_alert.assert_called_once()
    assert mock_alert.call_args[0][0] == ["adm@b.com"]


def test_keine_luecke_kein_alarm(db_session, session_factory, mocker):
    _vorheriger_lauf(db_session, minuten_zurueck=15)
    mock_alert = mocker.patch("worker.worker.send_worker_gap_alert")
    run(datetime(2026, 4, 10, 18, 0), session_factory)
    mock_alert.assert_not_called()


def test_allererster_lauf_alarmiert_nicht(db_session, session_factory, mocker):
    mock_alert = mocker.patch("worker.worker.send_worker_gap_alert")
    run(datetime(2026, 4, 10, 18, 0), session_factory)
    mock_alert.assert_not_called()
```

- [ ] **Step 2: Fehlschlag verifizieren** — Run: `venv/bin/pytest tests/worker/test_worker_runs.py -v`, Expected: `ImportError`/`AttributeError` zu `send_worker_gap_alert`

- [ ] **Step 3: E-Mail-Funktion + Template**

```python
# worker/email.py — ergänzen (Muster wie send_admin_booking_failure_email)
def send_worker_gap_alert(admin_emails: list[str], gap_minutes: int, last_run_at: str) -> None:
    html = _templates.get_template("worker_gap_alert.html").render(
        gap_minutes=gap_minutes,
        last_run_at=last_run_at,
        frontend_url=os.environ.get("FRONTEND_URL", ""),
    )
    _send(to=admin_emails, subject=f"⚠️ Worker-Lücke: {gap_minutes} Minuten ohne Lauf", html=html)
```

(Existiert kein `_send`-Helper, das Versand-Muster der bestehenden Funktionen in `worker/email.py` kopieren.)

```html
<!-- worker/templates/email/worker_gap_alert.html -->
<html><body style="font-family: sans-serif;">
  <h2>⚠️ Worker-Ausfall erkannt</h2>
  <p>Zwischen dem letzten protokollierten Lauf ({{ last_run_at }}) und jetzt
     liegen <strong>{{ gap_minutes }} Minuten</strong> — der CronJob (Soll: alle 15 Minuten)
     hat in diesem Zeitraum nicht gearbeitet.</p>
  <p>Verpasste Buchungen wurden nachgeholt, sofern der Kurstermin noch in der Zukunft lag
     (siehe Buchungs-Logs). Bitte CronJob-Status im Cluster prüfen.</p>
  <p><a href="{{ frontend_url }}">{{ frontend_url }}</a></p>
</body></html>
```

- [ ] **Step 4: Lücken-Prüfung in run()** — VOR `_record_run` (damit der aktuelle Lauf die Lücke nicht verdeckt):

```python
# worker/worker.py — Import ergänzen: from worker.email import ..., send_worker_gap_alert
_GAP_ALERT_MINUTES = 60


def _check_run_gap(session_factory, admin_emails: list[str]) -> None:
    from backend.models.worker_run import WorkerRun
    db = session_factory()
    try:
        last = db.query(WorkerRun).order_by(WorkerRun.started_at.desc()).first()
        if last is None or not admin_emails:
            return
        gap = datetime.now(timezone.utc) - _as_utc(last.started_at)
        gap_minutes = int(gap.total_seconds() // 60)
        if gap_minutes > _GAP_ALERT_MINUTES:
            try:
                send_worker_gap_alert(admin_emails, gap_minutes, _as_utc(last.started_at).isoformat())
            except Exception as exc:
                log.error("Worker-Gap-Alarm konnte nicht gesendet werden: %s", exc)
    finally:
        db.close()
```

Aufruf in `run()` direkt nach dem Ermitteln von `admin_emails` (vor dem ThreadPool): `_check_run_gap(session_factory, admin_emails)`.

- [ ] **Step 5: Gesamtsuite + Commit**

Run: `venv/bin/pytest tests/ -q` — Expected: alle passed

```bash
git add worker/ tests/worker/test_worker_runs.py
git commit -m "feat(metrics): Admin-Alarm bei Worker-Lücken über 60 Minuten"
```

---

### Task 4: Admin-Metrics-Endpoint

**Files:**
- Modify: `backend/api/admin.py`
- Test: `tests/backend/test_api_admin_metrics.py`

- [ ] **Step 1: Failing Tests**

```python
# tests/backend/test_api_admin_metrics.py
from datetime import datetime, timedelta, timezone

from backend.core.auth import create_access_token
from backend.models.user import User
from backend.models.worker_run import WorkerRun


def _admin(db):
    u = User(id="adm", eversports_user_id="ev-adm", email="adm@x.com",
             encrypted_password="x", active=True, role="admin")
    db.add(u)
    db.commit()
    return u


def _run_row(db, minutes_ago: int, succeeded=1, failed=0):
    t = datetime.now(timezone.utc) - timedelta(minutes=minutes_ago)
    db.add(WorkerRun(started_at=t, finished_at=t, jobs_due=succeeded + failed,
                     succeeded=succeeded, failed=failed, waitlisted=0))
    db.commit()


def test_metrics_liefert_letzte_laeufe_und_erfolgsrate(client, db_session):
    admin = _admin(db_session)
    _run_row(db_session, minutes_ago=10, succeeded=3, failed=1)
    _run_row(db_session, minutes_ago=25, succeeded=2, failed=0)
    resp = client.get("/api/admin/metrics",
                      headers={"Authorization": f"Bearer {create_access_token(admin.id)}"})
    assert resp.status_code == 200
    body = resp.json()
    assert len(body["recent_runs"]) == 2
    assert body["last_run_age_minutes"] <= 11
    assert body["worker_stale"] is False
    assert body["success_rate_24h"] == pytest.approx(5 / 6)


def test_metrics_meldet_stale_worker(client, db_session):
    admin = _admin(db_session)
    _run_row(db_session, minutes_ago=120)
    resp = client.get("/api/admin/metrics",
                      headers={"Authorization": f"Bearer {create_access_token(admin.id)}"})
    assert resp.json()["worker_stale"] is True


def test_metrics_ohne_laeufe(client, db_session):
    admin = _admin(db_session)
    resp = client.get("/api/admin/metrics",
                      headers={"Authorization": f"Bearer {create_access_token(admin.id)}"})
    body = resp.json()
    assert body["recent_runs"] == []
    assert body["last_run_age_minutes"] is None
    assert body["worker_stale"] is True


def test_metrics_nur_fuer_admins(client, db_session):
    user = User(id="u1", eversports_user_id="ev-u1", email="u@x.com",
                encrypted_password="x", active=True, role="user")
    db_session.add(user)
    db_session.commit()
    resp = client.get("/api/admin/metrics",
                      headers={"Authorization": f"Bearer {create_access_token('u1')}"})
    assert resp.status_code == 403


import pytest  # noqa: E402 (für pytest.approx oben)
```

- [ ] **Step 2: Fehlschlag verifizieren** — Run: `venv/bin/pytest tests/backend/test_api_admin_metrics.py -v`, Expected: 404-Fehler

- [ ] **Step 3: Endpoint implementieren** (in `backend/api/admin.py`, Muster der bestehenden Admin-Routen mit `require_admin`):

```python
from datetime import datetime, timedelta, timezone

from backend.models.worker_run import WorkerRun

_STALE_MINUTES = 30  # zwei verpasste 15-Minuten-Slots


class WorkerRunResponse(BaseModel):
    started_at: datetime
    finished_at: datetime
    jobs_due: int
    succeeded: int
    failed: int
    waitlisted: int

    model_config = {"from_attributes": True}


class MetricsResponse(BaseModel):
    recent_runs: list[WorkerRunResponse]
    last_run_age_minutes: int | None
    worker_stale: bool
    success_rate_24h: float | None


@router.get("/admin/metrics", response_model=MetricsResponse)
def get_metrics(
    _: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    recent = (
        db.query(WorkerRun).order_by(WorkerRun.started_at.desc()).limit(20).all()
    )
    if recent:
        last_started = recent[0].started_at
        if last_started.tzinfo is None:
            last_started = last_started.replace(tzinfo=timezone.utc)
        age = int((now - last_started).total_seconds() // 60)
    else:
        age = None

    day_ago = now - timedelta(hours=24)
    day_runs = db.query(WorkerRun).filter(WorkerRun.started_at >= day_ago).all()
    attempts = sum(r.succeeded + r.failed for r in day_runs)
    success_rate = (sum(r.succeeded for r in day_runs) / attempts) if attempts else None

    return MetricsResponse(
        recent_runs=recent,
        last_run_age_minutes=age,
        worker_stale=(age is None or age > _STALE_MINUTES),
        success_rate_24h=success_rate,
    )
```

- [ ] **Step 4: Gesamtsuite + Commit**

Run: `venv/bin/pytest tests/ -q` — Expected: alle passed

```bash
git add backend/api/admin.py tests/backend/test_api_admin_metrics.py
git commit -m "feat(metrics): Admin-Endpoint mit Lauf-Historie, Erfolgsrate und Stale-Flag"
```

---

### Task 5: Optionaler Sentry-Hook

**Files:**
- Modify: `requirements-backend.txt` (+ `sentry-sdk[fastapi]==2.x` — aktuelle Version beim Implementieren prüfen)
- Modify: `backend/main.py`, `worker/worker.py` (`main()`), `CLAUDE.md` (Env-Tabelle), `k8s/backend-deployment.yaml` + `k8s/worker-cronjob.yaml` (Env aus Secret, optional)

- [ ] **Step 1: Init-Code (kein TDD — Konfigurations-Hook ohne eigene Logik; Absprache laut TDD-Skill: Konfiguration ist Ausnahme)**

```python
# backend/main.py — vor app = FastAPI(...):
if os.environ.get("SENTRY_DSN"):
    import sentry_sdk
    sentry_sdk.init(dsn=os.environ["SENTRY_DSN"], traces_sample_rate=0.0)
```

```python
# worker/worker.py — in main(), vor run(...):
    if os.environ.get("SENTRY_DSN"):
        import sentry_sdk
        sentry_sdk.init(dsn=os.environ["SENTRY_DSN"], traces_sample_rate=0.0)
```

- [ ] **Step 2: CLAUDE.md-Env-Tabelle ergänzen**

```markdown
| `SENTRY_DSN` | — | Sentry-Error-Tracking für Backend und Worker (optional) |
```

- [ ] **Step 3: Verifizieren, dass alles ohne SENTRY_DSN unverändert läuft**

Run: `venv/bin/pytest tests/ -q` — Expected: alle passed (kein Import von sentry_sdk ohne DSN)

- [ ] **Step 4: Commit**

```bash
git add requirements-backend.txt backend/main.py worker/worker.py CLAUDE.md k8s/
git commit -m "feat(metrics): optionaler Sentry-Hook hinter SENTRY_DSN"
```

---

## Self-Review-Notizen

- Prometheus/Pushgateway bewusst NICHT in diesem Plan: CronJob-Worker ist nicht scrapbar, Pushgateway wäre neue Infrastruktur. Die DB-basierte Lösung deckt die zwei realen Fragen ab („läuft der Worker?", „bucht er erfolgreich?") und ein späterer Prometheus-Export kann `worker_runs` einfach ablesen.
- Der Lücken-Alarm feuert pro entdeckter Lücke genau einmal (der nächste Lauf protokolliert sich selbst und schließt die Lücke) — kein Alert-Spam, keine Entduplizierungs-Logik nötig.
- `test_metrics_liefert_letzte_laeufe_und_erfolgsrate` nutzt `pytest.approx` — Import steht im Testfile.
- Frontend-Anzeige der Metriken ist bewusst außen vor (separates, kleines UI-Follow-up, wenn gewünscht).
