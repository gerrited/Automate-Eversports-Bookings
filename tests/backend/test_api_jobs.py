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
