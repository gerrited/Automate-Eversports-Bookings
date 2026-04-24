# Job-Limit pro Benutzer — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das `users`-Modell erhält ein optionales Limit für aktive Buchungen (`max_active_jobs`). Beim Erstellen und Aktivieren eines Jobs wird geprüft, ob das Limit bereits erreicht ist — wenn ja, wird HTTP 409 zurückgegeben.

**Architecture:** Neues nullable Integer-Feld `max_active_jobs` in der `users`-Tabelle (Alembic-Migration). In `backend/api/jobs.py` ergänzt eine neue Hilfsfunktion `_check_job_limit` die bestehenden Endpunkte `create_job` und `toggle_job` um die Prüfung.

**Tech Stack:** Python, FastAPI, SQLAlchemy, Alembic, pytest

---

## Betroffene Dateien

| Aktion | Datei |
|--------|-------|
| Ändern | `backend/models/user.py` |
| Erstellen | `backend/alembic/versions/<rev>_add_max_active_jobs_to_users.py` |
| Ändern | `backend/api/jobs.py` |
| Ändern | `tests/backend/test_api_jobs.py` |

---

### Task 1: `max_active_jobs` zum User-Modell hinzufügen

**Files:**
- Modify: `backend/models/user.py`

- [ ] **Step 1: Feld im SQLAlchemy-Modell ergänzen**

  In `backend/models/user.py` den Import von `Integer` hinzufügen und das Feld einfügen:

  ```python
  import uuid
  from datetime import datetime, timezone
  from sqlalchemy import Column, String, DateTime, Boolean, Integer
  from sqlalchemy.orm import relationship
  from backend.db import Base


  class User(Base):
      __tablename__ = "users"

      id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
      eversports_user_id = Column(String, unique=True, nullable=False)
      email = Column(String, unique=True, nullable=False)
      encrypted_password = Column(String, nullable=False)
      active = Column(Boolean, default=False, nullable=False)
      role = Column(String, default="user", nullable=False)
      max_active_jobs = Column(Integer, nullable=True)
      created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

      jobs = relationship("BookingJob", back_populates="user", cascade="all, delete-orphan")
  ```

- [ ] **Step 2: Alembic-Migration erstellen**

  ```bash
  DATABASE_URL=sqlite:///eversports.db \
    alembic -c backend/alembic.ini revision --autogenerate -m "add_max_active_jobs_to_users"
  ```

  Die generierte Datei in `backend/alembic/versions/` öffnen und sicherstellen, dass `upgrade()` und `downgrade()` so aussehen (Revision-IDs werden von Alembic generiert):

  ```python
  def upgrade() -> None:
      op.add_column('users', sa.Column('max_active_jobs', sa.Integer(), nullable=True))

  def downgrade() -> None:
      op.drop_column('users', 'max_active_jobs')
  ```

- [ ] **Step 3: Migration lokal einspielen**

  ```bash
  DATABASE_URL=sqlite:///eversports.db \
    alembic -c backend/alembic.ini upgrade head
  ```

  Erwartete Ausgabe: `Running upgrade ... -> <rev>, add_max_active_jobs_to_users`

- [ ] **Step 4: Commit**

  ```bash
  git add backend/models/user.py backend/alembic/versions/
  git commit -m "feat: add max_active_jobs field to users model and migration"
  ```

---

### Task 2: Prüflogik und Tests implementieren

**Files:**
- Modify: `backend/api/jobs.py`
- Modify: `tests/backend/test_api_jobs.py`

- [ ] **Step 1: Tests für `_check_job_limit` schreiben (werden zunächst fehlschlagen)**

  Am Ende von `tests/backend/test_api_jobs.py` folgende Tests hinzufügen:

  ```python
  def test_create_job_respects_limit(client, db_session):
      user = _create_user(db_session)
      user.max_active_jobs = 1
      db_session.commit()

      payload = {
          "weekday": 1,
          "target_time": "18:00:00",
          "facility_id": "73041",
          "facility_name": "CrossFit Rabbit Hole",
          "class_name": "CrossFit",
          "days_in_advance": 4,
      }
      # Erster Job — erlaubt
      resp = client.post("/api/jobs", json=payload, headers=_auth_header(user.id))
      assert resp.status_code == 201

      # Zweiter Job — Limit erreicht
      payload2 = {**payload, "weekday": 2}
      resp2 = client.post("/api/jobs", json=payload2, headers=_auth_header(user.id))
      assert resp2.status_code == 409
      assert "Limit" in resp2.json()["detail"]


  def test_create_job_no_limit_when_null(client, db_session):
      user = _create_user(db_session)
      # max_active_jobs ist NULL — unbegrenzt

      for weekday in range(5):
          payload = {
              "weekday": weekday,
              "target_time": "18:00:00",
              "facility_id": "73041",
              "facility_name": "CrossFit Rabbit Hole",
              "class_name": "CrossFit",
              "days_in_advance": 4,
          }
          resp = client.post("/api/jobs", json=payload, headers=_auth_header(user.id))
          assert resp.status_code == 201


  def test_toggle_job_respects_limit(client, db_session):
      user = _create_user(db_session)
      user.max_active_jobs = 1
      db_session.commit()

      payload_base = {
          "weekday": 1,
          "target_time": "18:00:00",
          "facility_id": "73041",
          "facility_name": "CrossFit Rabbit Hole",
          "class_name": "CrossFit",
          "days_in_advance": 4,
      }
      # Ersten Job erstellen (aktiv)
      resp1 = client.post("/api/jobs", json=payload_base, headers=_auth_header(user.id))
      assert resp1.status_code == 201
      job1_id = resp1.json()["id"]

      # Zweiten Job erstellen — schlägt wegen Limit fehl
      # Deswegen: Limit kurz erhöhen, Job erstellen, dann deaktivieren
      user.max_active_jobs = 2
      db_session.commit()
      payload2 = {**payload_base, "weekday": 2}
      resp2 = client.post("/api/jobs", json=payload2, headers=_auth_header(user.id))
      assert resp2.status_code == 201
      job2_id = resp2.json()["id"]

      # job2 deaktivieren
      client.patch(f"/api/jobs/{job2_id}/toggle", headers=_auth_header(user.id))

      # Limit wieder auf 1 setzen
      user.max_active_jobs = 1
      db_session.commit()

      # job2 wieder aktivieren — Limit ist jetzt durch job1 belegt
      resp = client.patch(f"/api/jobs/{job2_id}/toggle", headers=_auth_header(user.id))
      assert resp.status_code == 409
      assert "Limit" in resp.json()["detail"]


  def test_toggle_job_disable_ignores_limit(client, db_session):
      user = _create_user(db_session)
      user.max_active_jobs = 1
      db_session.commit()

      payload = {
          "weekday": 1,
          "target_time": "18:00:00",
          "facility_id": "73041",
          "facility_name": "CrossFit Rabbit Hole",
          "class_name": "CrossFit",
          "days_in_advance": 4,
      }
      resp = client.post("/api/jobs", json=payload, headers=_auth_header(user.id))
      assert resp.status_code == 201
      job_id = resp.json()["id"]

      # Deaktivieren soll immer klappen, egal was das Limit ist
      resp = client.patch(f"/api/jobs/{job_id}/toggle", headers=_auth_header(user.id))
      assert resp.status_code == 200
      assert resp.json()["enabled"] is False
  ```

- [ ] **Step 2: Tests ausführen — müssen fehlschlagen**

  ```bash
  pytest tests/backend/test_api_jobs.py::test_create_job_respects_limit \
         tests/backend/test_api_jobs.py::test_toggle_job_respects_limit -v
  ```

  Erwartete Ausgabe: `FAILED` — die Endpunkte prüfen das Limit noch nicht.

- [ ] **Step 3: `_check_job_limit` in `backend/api/jobs.py` implementieren**

  Nach der `_find_duplicate`-Funktion (nach Zeile 39) einfügen:

  ```python
  def _check_job_limit(user: User, db: Session) -> None:
      if user.max_active_jobs is None:
          return
      active_count = db.query(BookingJob).filter(
          BookingJob.user_id == user.id,
          BookingJob.enabled == True,
      ).count()
      if active_count >= user.max_active_jobs:
          raise HTTPException(
              status_code=409,
              detail=f"Limit von {user.max_active_jobs} aktiven Buchungen erreicht.",
          )
  ```

- [ ] **Step 4: `create_job` um Limit-Prüfung erweitern**

  In `create_job` (Zeile 81) nach der Duplikat-Prüfung einfügen:

  ```python
  @router.post("/jobs", response_model=JobResponse, status_code=201)
  def create_job(
      body: JobCreate,
      current_user: User = Depends(get_current_active_user),
      db: Session = Depends(get_db),
  ):
      if _find_duplicate(current_user.id, body.weekday, body.target_time, body.facility_id, body.class_name, db):
          raise HTTPException(status_code=409, detail="Ein identischer Job existiert bereits.")
      _check_job_limit(current_user, db)
      job = BookingJob(**body.model_dump(), user_id=current_user.id)
      db.add(job)
      db.commit()
      db.refresh(job)
      return job
  ```

- [ ] **Step 5: `toggle_job` um Limit-Prüfung erweitern**

  `toggle_job` (Zeile 108) anpassen — Prüfung nur beim Aktivieren:

  ```python
  @router.patch("/jobs/{job_id}/toggle", response_model=JobResponse)
  def toggle_job(
      job_id: str,
      current_user: User = Depends(get_current_active_user),
      db: Session = Depends(get_db),
  ):
      job = _get_owned_job(job_id, current_user, db)
      if not job.enabled:
          _check_job_limit(current_user, db)
      job.enabled = not job.enabled
      db.commit()
      db.refresh(job)
      return job
  ```

- [ ] **Step 6: Alle neuen Tests ausführen**

  ```bash
  pytest tests/backend/test_api_jobs.py -v
  ```

  Erwartete Ausgabe: Alle Tests `PASSED`.

- [ ] **Step 7: Gesamte Test-Suite ausführen**

  ```bash
  pytest tests/ -x
  ```

  Erwartete Ausgabe: Alle Tests `PASSED`, keine Regressionen.

- [ ] **Step 8: Commit**

  ```bash
  git add backend/api/jobs.py tests/backend/test_api_jobs.py
  git commit -m "feat: enforce max_active_jobs limit on create and toggle"
  ```
