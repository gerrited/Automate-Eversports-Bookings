from unittest.mock import patch

from backend.core.auth import create_access_token
from backend.models.user import User


def _auth_header(user_id: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _create_user(db_session) -> User:
    user = User(eversports_user_id="ev-1", email="a@b.com", encrypted_password="x", active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_list_jobs_empty(client, db_session):
    user = _create_user(db_session)
    resp = client.get("/api/jobs", headers=_auth_header(user.id))
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_job(client, db_session):
    user = _create_user(db_session)
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
    body = resp.json()
    assert body["weekday"] == 1
    assert body["facility_id"] == "73041"
    assert body["enabled"] is True
    assert body["one_time"] is False


def test_update_job(client, db_session):
    user = _create_user(db_session)
    create_resp = client.post(
        "/api/jobs",
        json={"weekday": 1, "target_time": "18:00:00", "facility_id": "73041", "facility_name": "CrossFit Rabbit Hole", "class_name": "CrossFit", "days_in_advance": 4},
        headers=_auth_header(user.id),
    )
    job_id = create_resp.json()["id"]
    resp = client.put(f"/api/jobs/{job_id}", json={"class_name": "Yoga"}, headers=_auth_header(user.id))
    assert resp.status_code == 200
    assert resp.json()["class_name"] == "Yoga"


def test_toggle_job(client, db_session):
    user = _create_user(db_session)
    create_resp = client.post(
        "/api/jobs",
        json={"weekday": 1, "target_time": "18:00:00", "facility_id": "73041", "facility_name": "CrossFit Rabbit Hole", "class_name": "CrossFit", "days_in_advance": 4},
        headers=_auth_header(user.id),
    )
    job_id = create_resp.json()["id"]
    resp = client.patch(f"/api/jobs/{job_id}/toggle", headers=_auth_header(user.id))
    assert resp.status_code == 200
    assert resp.json()["enabled"] is False


def test_delete_job(client, db_session):
    user = _create_user(db_session)
    create_resp = client.post(
        "/api/jobs",
        json={"weekday": 1, "target_time": "18:00:00", "facility_id": "73041", "facility_name": "CrossFit Rabbit Hole", "class_name": "CrossFit", "days_in_advance": 4},
        headers=_auth_header(user.id),
    )
    job_id = create_resp.json()["id"]
    resp = client.delete(f"/api/jobs/{job_id}", headers=_auth_header(user.id))
    assert resp.status_code == 204
    assert client.get("/api/jobs", headers=_auth_header(user.id)).json() == []


def test_cannot_access_other_users_job(client, db_session):
    user_a = _create_user(db_session)
    user_b = User(eversports_user_id="ev-2", email="b@b.com", encrypted_password="x")
    db_session.add(user_b)
    db_session.commit()
    db_session.refresh(user_b)

    create_resp = client.post(
        "/api/jobs",
        json={"weekday": 1, "target_time": "18:00:00", "facility_id": "73041", "facility_name": "CrossFit Rabbit Hole", "class_name": "CrossFit", "days_in_advance": 4},
        headers=_auth_header(user_a.id),
    )
    job_id = create_resp.json()["id"]
    resp = client.get(f"/api/jobs/{job_id}/logs", headers=_auth_header(user_b.id))
    assert resp.status_code == 403


def test_get_logs_empty(client, db_session):
    user = _create_user(db_session)
    create_resp = client.post(
        "/api/jobs",
        json={"weekday": 1, "target_time": "18:00:00", "facility_id": "73041", "facility_name": "CrossFit Rabbit Hole", "class_name": "CrossFit", "days_in_advance": 4},
        headers=_auth_header(user.id),
    )
    job_id = create_resp.json()["id"]
    resp = client.get(f"/api/jobs/{job_id}/logs", headers=_auth_header(user.id))
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_one_time_job(client, db_session):
    user = _create_user(db_session)
    payload = {
        "weekday": 2,
        "target_time": "10:00:00",
        "facility_id": "73041",
        "facility_name": "CrossFit Rabbit Hole",
        "class_name": "Yoga",
        "days_in_advance": 2,
        "one_time": True,
    }
    resp = client.post("/api/jobs", json=payload, headers=_auth_header(user.id))
    assert resp.status_code == 201
    assert resp.json()["one_time"] is True


def test_update_job_one_time_flag(client, db_session):
    user = _create_user(db_session)
    create_resp = client.post(
        "/api/jobs",
        json={"weekday": 1, "target_time": "18:00:00", "facility_id": "73041",
              "facility_name": "CrossFit Rabbit Hole", "class_name": "CrossFit",
              "days_in_advance": 4},
        headers=_auth_header(user.id),
    )
    job_id = create_resp.json()["id"]
    resp = client.put(f"/api/jobs/{job_id}", json={"one_time": True}, headers=_auth_header(user.id))
    assert resp.status_code == 200
    assert resp.json()["one_time"] is True


def _create_job(client, user_id: str) -> str:
    resp = client.post(
        "/api/jobs",
        json={
            "weekday": 1,
            "target_time": "18:00:00",
            "facility_id": "73041",
            "facility_name": "CrossFit Rabbit Hole",
            "class_name": "CrossFit",
            "days_in_advance": 4,
        },
        headers=_auth_header(user_id),
    )
    return resp.json()["id"]


def test_execute_job_success(client, db_session):
    user = _create_user(db_session)
    job_id = _create_job(client, user.id)

    with patch("backend.api.jobs.book_session", return_value={"status": "success", "order_id": "ord-1", "event_type": "class"}), \
         patch("backend.api.jobs.decrypt", return_value="password123"):
        resp = client.post(f"/api/jobs/{job_id}/execute", headers=_auth_header(user.id))

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "success"
    assert "message" in body


def test_execute_job_already_booked(client, db_session):
    user = _create_user(db_session)
    job_id = _create_job(client, user.id)

    with patch("backend.api.jobs.book_session", return_value={"status": "already_booked", "order_id": None, "event_type": "class"}), \
         patch("backend.api.jobs.decrypt", return_value="password123"):
        resp = client.post(f"/api/jobs/{job_id}/execute", headers=_auth_header(user.id))

    assert resp.status_code == 200
    assert resp.json()["status"] == "already_booked"


def test_execute_job_booking_error(client, db_session):
    user = _create_user(db_session)
    job_id = _create_job(client, user.id)

    with patch("backend.api.jobs.book_session", side_effect=RuntimeError("CrossFit 18:00 not found")), \
         patch("backend.api.jobs.decrypt", return_value="password123"):
        resp = client.post(f"/api/jobs/{job_id}/execute", headers=_auth_header(user.id))

    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "failed"
    assert "CrossFit 18:00 not found" in body["message"]


def test_execute_job_debug_mode_cancels_booking(client, db_session):
    user = _create_user(db_session)
    resp = client.post(
        "/api/jobs",
        json={
            "weekday": 1, "target_time": "18:00:00", "facility_id": "73041",
            "facility_name": "CrossFit Rabbit Hole", "class_name": "CrossFit",
            "days_in_advance": 4, "debug": True,
        },
        headers=_auth_header(user.id),
    )
    job_id = resp.json()["id"]

    from unittest.mock import MagicMock
    mock_session = MagicMock()
    with patch("backend.api.jobs.book_session", return_value={"status": "success", "order_id": "ord-1", "event_type": "class", "_session": None}), \
         patch("backend.api.jobs.decrypt", return_value="password123"), \
         patch("backend.api.jobs.time.sleep"), \
         patch("backend.api.jobs.eversports_login", return_value={"session": mock_session, "user_id": "u1", "avatar_url": None}), \
         patch("backend.api.jobs._cancel_with_session") as mock_cancel:
        resp = client.post(f"/api/jobs/{job_id}/execute", headers=_auth_header(user.id))

    assert resp.status_code == 200
    assert resp.json()["status"] == "success"
    assert "[DEBUG]" in resp.json()["message"]
    assert mock_cancel.call_count == 1
    call_kwargs = mock_cancel.call_args.kwargs
    assert call_kwargs["session"] is mock_session
    assert call_kwargs["class_name"] == "CrossFit"
    assert call_kwargs["facility_id"] == "73041"
    assert call_kwargs["target_date"] is not None
    assert call_kwargs["target_time"] == "18:00"


def test_execute_job_debug_cancel_failure(client, db_session):
    user = _create_user(db_session)
    resp = client.post(
        "/api/jobs",
        json={
            "weekday": 1, "target_time": "18:00:00", "facility_id": "73041",
            "facility_name": "CrossFit Rabbit Hole", "class_name": "CrossFit",
            "days_in_advance": 4, "debug": True,
        },
        headers=_auth_header(user.id),
    )
    job_id = resp.json()["id"]

    from unittest.mock import MagicMock
    with patch("backend.api.jobs.book_session", return_value={"status": "success", "order_id": "ord-1", "event_type": "class", "_session": None}), \
         patch("backend.api.jobs.decrypt", return_value="password123"), \
         patch("backend.api.jobs.time.sleep"), \
         patch("backend.api.jobs.eversports_login", return_value={"session": MagicMock(), "user_id": "u1", "avatar_url": None}), \
         patch("backend.api.jobs._cancel_with_session", side_effect=RuntimeError("No upcoming booking found")):
        resp = client.post(f"/api/jobs/{job_id}/execute", headers=_auth_header(user.id))

    assert resp.status_code == 200
    assert resp.json()["status"] == "success"
    assert "[DEBUG]" in resp.json()["message"]


def test_execute_job_forbidden_for_other_user(client, db_session):
    user_a = _create_user(db_session)
    user_b = User(eversports_user_id="ev-3", email="c@b.com", encrypted_password="x", active=True)
    db_session.add(user_b)
    db_session.commit()
    db_session.refresh(user_b)

    job_id = _create_job(client, user_a.id)
    resp = client.post(f"/api/jobs/{job_id}/execute", headers=_auth_header(user_b.id))
    assert resp.status_code == 403


def test_execute_job_success_writes_log(client, db_session):
    from backend.models.booking_log import BookingLog
    user = _create_user(db_session)
    job_id = _create_job(client, user.id)

    with patch("backend.api.jobs.book_session", return_value={"status": "success", "order_id": "ord-1", "event_type": "class"}), \
         patch("backend.api.jobs.decrypt", return_value="password123"):
        client.post(f"/api/jobs/{job_id}/execute", headers=_auth_header(user.id))

    log = db_session.query(BookingLog).filter(BookingLog.job_id == job_id).first()
    assert log is not None
    assert log.status == "success"


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


# --- next_run_at ---

def _parse_next_run(body: dict):
    from datetime import datetime, timezone
    raw = body["next_run_at"]
    assert raw is not None
    dt = datetime.fromisoformat(raw)
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def test_create_job_setzt_next_run_at(client, db_session):
    from datetime import datetime, timedelta, timezone
    from zoneinfo import ZoneInfo

    user = _create_user(db_session)
    resp = client.post(
        "/api/jobs",
        json={"weekday": 1, "target_time": "18:00:00", "facility_id": "73041",
              "facility_name": "X", "class_name": "CrossFit", "days_in_advance": 4},
        headers=_auth_header(user.id),
    )
    assert resp.status_code == 201
    next_run = _parse_next_run(resp.json())
    assert next_run > datetime.now(timezone.utc)
    # Lauftag + Vorlauf ergibt den gewünschten Kurstag, Lauf um 18:00 Berlin
    run_berlin = next_run.astimezone(ZoneInfo("Europe/Berlin"))
    assert (run_berlin.date() + timedelta(days=4)).weekday() == 1
    assert run_berlin.strftime("%H:%M") == "18:00"


def test_update_job_berechnet_next_run_at_neu(client, db_session):
    from zoneinfo import ZoneInfo

    user = _create_user(db_session)
    job_id = _create_job(client, user.id)

    resp = client.put(f"/api/jobs/{job_id}", json={"target_time": "07:00:00"}, headers=_auth_header(user.id))
    assert resp.status_code == 200
    next_run = _parse_next_run(resp.json())
    assert next_run.astimezone(ZoneInfo("Europe/Berlin")).strftime("%H:%M") == "07:00"


def test_toggle_on_berechnet_next_run_at_neu(client, db_session):
    from datetime import datetime, timezone

    from backend.models.booking_job import BookingJob

    user = _create_user(db_session)
    job_id = _create_job(client, user.id)

    # Während der Job deaktiviert war, ist sein Termin verstrichen
    client.patch(f"/api/jobs/{job_id}/toggle", headers=_auth_header(user.id))  # off
    job = db_session.query(BookingJob).filter(BookingJob.id == job_id).first()
    job.next_run_at = datetime(2020, 1, 3, 17, 0, tzinfo=timezone.utc)
    db_session.commit()

    resp = client.patch(f"/api/jobs/{job_id}/toggle", headers=_auth_header(user.id))  # on
    assert resp.status_code == 200
    next_run = _parse_next_run(resp.json())
    # kein Nachhol-Lauf aus der Deaktivierungs-Zeit: Termin liegt in der Zukunft
    assert next_run > datetime.now(timezone.utc)
