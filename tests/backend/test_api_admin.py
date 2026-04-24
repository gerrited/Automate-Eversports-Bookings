import os
from datetime import date, time

os.environ.setdefault("ENCRYPTION_KEY", os.urandom(32).hex())
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-do-not-use-in-prod")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")

from backend.core.auth import create_access_token
from backend.models.booking_job import BookingJob
from backend.models.booking_log import BookingLog
from backend.models.user import User


def _auth_header(user_id: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _make_admin(db_session, ev_id="ev-admin", email="admin@x.com") -> User:
    user = User(
        eversports_user_id=ev_id,
        email=email,
        encrypted_password="x",
        active=True,
        role="admin",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _make_user(db_session, ev_id="ev-user", email="user@x.com", active=True) -> User:
    user = User(
        eversports_user_id=ev_id,
        email=email,
        encrypted_password="x",
        active=active,
        role="user",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def test_list_users_requires_auth(client):
    resp = client.get("/api/admin/users")
    assert resp.status_code == 401


def test_list_users_requires_admin_role(client, db_session):
    user = _make_user(db_session)
    resp = client.get("/api/admin/users", headers=_auth_header(user.id))
    assert resp.status_code == 403


def test_list_users_returns_all_users(client, db_session):
    admin = _make_admin(db_session)
    _make_user(db_session, ev_id="ev-u2", email="other@x.com")
    resp = client.get("/api/admin/users", headers=_auth_header(admin.id))
    assert resp.status_code == 200
    emails = [u["email"] for u in resp.json()]
    assert "admin@x.com" in emails
    assert "other@x.com" in emails


def test_set_active_activates_user(client, db_session):
    admin = _make_admin(db_session)
    user = _make_user(db_session, ev_id="ev-u3", email="inactive@x.com", active=False)
    resp = client.patch(
        f"/api/admin/users/{user.id}/active",
        json={"active": True},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 200
    assert resp.json()["active"] is True


def test_set_active_deactivates_user(client, db_session):
    admin = _make_admin(db_session)
    user = _make_user(db_session, ev_id="ev-u4", email="active@x.com", active=True)
    resp = client.patch(
        f"/api/admin/users/{user.id}/active",
        json={"active": False},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 200
    assert resp.json()["active"] is False


def test_admin_cannot_deactivate_self(client, db_session):
    admin = _make_admin(db_session)
    resp = client.patch(
        f"/api/admin/users/{admin.id}/active",
        json={"active": False},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Cannot deactivate your own account"


def test_set_active_user_not_found(client, db_session):
    admin = _make_admin(db_session)
    resp = client.patch(
        "/api/admin/users/nonexistent-id/active",
        json={"active": True},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 404


# --- email notifications ---

def test_activation_sends_status_email(client, db_session, mocker):
    admin = _make_admin(db_session)
    user = _make_user(db_session, ev_id="ev-notify1", email="notify1@x.com", active=False)
    mock_email = mocker.patch("backend.api.admin.send_account_status_email")

    resp = client.patch(
        f"/api/admin/users/{user.id}/active",
        json={"active": True},
        headers=_auth_header(admin.id),
    )

    assert resp.status_code == 200
    mock_email.assert_called_once_with("notify1@x.com", True)


def test_deactivation_sends_status_email(client, db_session, mocker):
    admin = _make_admin(db_session)
    user = _make_user(db_session, ev_id="ev-notify2", email="notify2@x.com", active=True)
    mock_email = mocker.patch("backend.api.admin.send_account_status_email")

    resp = client.patch(
        f"/api/admin/users/{user.id}/active",
        json={"active": False},
        headers=_auth_header(admin.id),
    )

    assert resp.status_code == 200
    mock_email.assert_called_once_with("notify2@x.com", False)


def test_status_email_failure_does_not_affect_response(client, db_session, mocker):
    admin = _make_admin(db_session)
    user = _make_user(db_session, ev_id="ev-notify3", email="notify3@x.com", active=False)
    mocker.patch(
        "backend.api.admin.send_account_status_email",
        side_effect=Exception("Resend down"),
    )

    resp = client.patch(
        f"/api/admin/users/{user.id}/active",
        json={"active": True},
        headers=_auth_header(admin.id),
    )

    assert resp.status_code == 200
    assert resp.json()["active"] is True


def test_no_email_when_user_not_found(client, db_session, mocker):
    admin = _make_admin(db_session)
    mock_email = mocker.patch("backend.api.admin.send_account_status_email")

    resp = client.patch(
        "/api/admin/users/nonexistent-id/active",
        json={"active": True},
        headers=_auth_header(admin.id),
    )

    assert resp.status_code == 404
    mock_email.assert_not_called()


# --- /admin/jobs ---


def _make_job(db_session, user_id: str, weekday: int = 0, target_time=time(18, 0)) -> BookingJob:
    job = BookingJob(
        user_id=user_id,
        weekday=weekday,
        target_time=target_time,
        facility_id="fac-1",
        facility_name="Studio A",
        class_name="Yoga",
        days_in_advance=3,
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)
    return job


def _make_log(db_session, job_id: str, status: str = "success") -> BookingLog:
    log = BookingLog(
        job_id=job_id,
        target_date=date(2026, 1, 1),
        status=status,
    )
    db_session.add(log)
    db_session.commit()
    return log


def test_list_all_jobs_requires_auth(client):
    resp = client.get("/api/admin/jobs")
    assert resp.status_code == 401


def test_list_all_jobs_requires_admin_role(client, db_session):
    user = _make_user(db_session, ev_id="ev-nonadmin", email="nonadmin@x.com")
    resp = client.get("/api/admin/jobs", headers=_auth_header(user.id))
    assert resp.status_code == 403


def test_list_all_jobs_returns_all_users_jobs(client, db_session):
    admin = _make_admin(db_session, ev_id="ev-a1", email="admin1@x.com")
    user = _make_user(db_session, ev_id="ev-u1", email="user1@x.com")
    _make_job(db_session, admin.id)
    _make_job(db_session, user.id)
    resp = client.get("/api/admin/jobs", headers=_auth_header(admin.id))
    assert resp.status_code == 200
    emails = [j["user_email"] for j in resp.json()]
    assert "admin1@x.com" in emails
    assert "user1@x.com" in emails


def test_list_all_jobs_counts_by_status(client, db_session):
    admin = _make_admin(db_session, ev_id="ev-a2", email="admin2@x.com")
    user = _make_user(db_session, ev_id="ev-u2", email="user2@x.com")
    job = _make_job(db_session, user.id)
    _make_log(db_session, job.id, status="success")
    _make_log(db_session, job.id, status="success")
    _make_log(db_session, job.id, status="failed")
    _make_log(db_session, job.id, status="already_booked")
    resp = client.get("/api/admin/jobs", headers=_auth_header(admin.id))
    assert resp.status_code == 200
    job_data = next(j for j in resp.json() if j["user_email"] == "user2@x.com")
    assert job_data["success_count"] == 2
    assert job_data["failed_count"] == 1
    assert job_data["already_booked_count"] == 1
    assert "execution_count" not in job_data


def test_list_all_jobs_zero_counts_when_no_logs(client, db_session):
    admin = _make_admin(db_session, ev_id="ev-a3", email="admin3@x.com")
    user = _make_user(db_session, ev_id="ev-u3", email="user3@x.com")
    _make_job(db_session, user.id)
    resp = client.get("/api/admin/jobs", headers=_auth_header(admin.id))
    assert resp.status_code == 200
    job_data = next(j for j in resp.json() if j["user_email"] == "user3@x.com")
    assert job_data["success_count"] == 0
    assert job_data["failed_count"] == 0
    assert job_data["already_booked_count"] == 0


def test_list_all_jobs_sorted_by_weekday_time_email(client, db_session):
    admin = _make_admin(db_session, ev_id="ev-a4", email="admin4@x.com")
    u1 = _make_user(db_session, ev_id="ev-s1", email="b@x.com")
    u2 = _make_user(db_session, ev_id="ev-s2", email="a@x.com")
    _make_job(db_session, u1.id, weekday=1, target_time=time(10, 0))
    _make_job(db_session, u2.id, weekday=0, target_time=time(18, 0))
    _make_job(db_session, u1.id, weekday=0, target_time=time(8, 0))
    resp = client.get("/api/admin/jobs", headers=_auth_header(admin.id))
    assert resp.status_code == 200
    jobs = resp.json()
    weekdays = [j["weekday"] for j in jobs]
    assert weekdays == sorted(weekdays)
    # Within each weekday, verify target_time ordering
    weekday_0_jobs = [j for j in jobs if j["weekday"] == 0]
    times = [j["target_time"] for j in weekday_0_jobs]
    assert times == sorted(times)


# --- /admin/test-email ---

def test_send_test_email_requires_admin(client, db_session):
    user = _make_user(db_session, ev_id="ev-te1", email="te1@x.com")
    resp = client.post(
        "/api/admin/test-email",
        json={"type": "new_user"},
        headers=_auth_header(user.id),
    )
    assert resp.status_code == 403


def test_send_test_email_no_config_returns_503(client, db_session, monkeypatch):
    admin = _make_admin(db_session, ev_id="ev-te2", email="te2@x.com")
    monkeypatch.delenv("RESEND_API_KEY", raising=False)
    monkeypatch.delenv("FROM_EMAIL", raising=False)
    resp = client.post(
        "/api/admin/test-email",
        json={"type": "new_user"},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 503


def test_send_test_email_calls_send_test_email(client, db_session, mocker):
    admin = _make_admin(db_session, ev_id="ev-te3", email="te3@x.com")
    mocker.patch.dict(os.environ, {"RESEND_API_KEY": "key", "FROM_EMAIL": "from@x.com"})
    mock_fn = mocker.patch("backend.api.admin.send_test_email")
    resp = client.post(
        "/api/admin/test-email",
        json={"type": "booking_failure"},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 200
    mock_fn.assert_called_once_with("te3@x.com", "booking_failure")


def test_send_test_email_invalid_type_returns_422(client, db_session):
    admin = _make_admin(db_session, ev_id="ev-te4", email="te4@x.com")
    resp = client.post(
        "/api/admin/test-email",
        json={"type": "nonexistent_type"},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 422


def test_send_test_email_send_error_returns_500(client, db_session, mocker):
    admin = _make_admin(db_session, ev_id="ev-te5", email="te5@x.com")
    mocker.patch.dict(os.environ, {"RESEND_API_KEY": "key", "FROM_EMAIL": "from@x.com"})
    mocker.patch("backend.api.admin.send_test_email", side_effect=Exception("Resend down"))
    resp = client.post(
        "/api/admin/test-email",
        json={"type": "new_user"},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 500


def test_list_users_includes_max_active_jobs_and_active_job_count(client, db_session):
    admin = _make_admin(db_session, ev_id="ev-lim-a", email="limadmin@x.com")
    user = _make_user(db_session, ev_id="ev-lim-u", email="limuser@x.com")
    user.max_active_jobs = 5
    _make_job(db_session, user.id)                 # enabled=True per Default
    _make_job(db_session, user.id, weekday=1)      # noch ein aktiver Job
    disabled_job = _make_job(db_session, user.id, weekday=2)
    disabled_job.enabled = False
    db_session.commit()

    resp = client.get("/api/admin/users", headers=_auth_header(admin.id))
    assert resp.status_code == 200
    data = next(u for u in resp.json() if u["email"] == "limuser@x.com")
    assert data["max_active_jobs"] == 5
    assert data["active_job_count"] == 2   # 2 aktiv, 1 deaktiviert
    assert data["job_count"] == 3


# --- /admin/users/{id}/limit ---

def test_set_limit_requires_admin(client, db_session):
    user = _make_user(db_session, ev_id="ev-sl0", email="sl0@x.com")
    resp = client.patch(
        f"/api/admin/users/{user.id}/limit",
        json={"max_active_jobs": 3},
        headers=_auth_header(user.id),
    )
    assert resp.status_code == 403


def test_set_limit_user_not_found(client, db_session):
    admin = _make_admin(db_session, ev_id="ev-sl1", email="sl1@x.com")
    resp = client.patch(
        "/api/admin/users/nonexistent/limit",
        json={"max_active_jobs": 3},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 404


def test_set_limit_sets_value(client, db_session):
    admin = _make_admin(db_session, ev_id="ev-sl2", email="sl2@x.com")
    user = _make_user(db_session, ev_id="ev-sl2u", email="sl2u@x.com")

    resp = client.patch(
        f"/api/admin/users/{user.id}/limit",
        json={"max_active_jobs": 3},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 200
    assert resp.json()["max_active_jobs"] == 3


def test_set_limit_to_null_clears_limit(client, db_session):
    admin = _make_admin(db_session, ev_id="ev-sl3", email="sl3@x.com")
    user = _make_user(db_session, ev_id="ev-sl3u", email="sl3u@x.com")
    user.max_active_jobs = 5
    db_session.commit()

    resp = client.patch(
        f"/api/admin/users/{user.id}/limit",
        json={"max_active_jobs": None},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 200
    assert resp.json()["max_active_jobs"] is None


def test_set_limit_above_active_jobs_no_deactivation(client, db_session, mocker):
    admin = _make_admin(db_session, ev_id="ev-sl4", email="sl4@x.com")
    user = _make_user(db_session, ev_id="ev-sl4u", email="sl4u@x.com")
    _make_job(db_session, user.id)
    _make_job(db_session, user.id, weekday=1)
    mock_email = mocker.patch("backend.api.admin.send_limit_enforced_email")

    resp = client.patch(
        f"/api/admin/users/{user.id}/limit",
        json={"max_active_jobs": 5},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 200
    assert resp.json()["active_job_count"] == 2
    mock_email.assert_not_called()


def test_set_limit_below_active_jobs_deactivates_all(client, db_session, mocker):
    admin = _make_admin(db_session, ev_id="ev-sl5", email="sl5@x.com")
    user = _make_user(db_session, ev_id="ev-sl5u", email="sl5u@x.com")
    _make_job(db_session, user.id)
    _make_job(db_session, user.id, weekday=1)
    _make_job(db_session, user.id, weekday=2)
    mock_email = mocker.patch("backend.api.admin.send_limit_enforced_email")

    resp = client.patch(
        f"/api/admin/users/{user.id}/limit",
        json={"max_active_jobs": 2},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 200
    assert resp.json()["active_job_count"] == 0
    mock_email.assert_called_once_with(user.email, 2)


def test_set_limit_email_failure_does_not_break_response(client, db_session, mocker):
    admin = _make_admin(db_session, ev_id="ev-sl6", email="sl6@x.com")
    user = _make_user(db_session, ev_id="ev-sl6u", email="sl6u@x.com")
    _make_job(db_session, user.id)
    _make_job(db_session, user.id, weekday=1)
    mocker.patch(
        "backend.api.admin.send_limit_enforced_email",
        side_effect=Exception("Resend down"),
    )

    resp = client.patch(
        f"/api/admin/users/{user.id}/limit",
        json={"max_active_jobs": 1},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 200
    assert resp.json()["active_job_count"] == 0


def test_set_limit_rejects_zero_or_negative(client, db_session):
    admin = _make_admin(db_session, ev_id="ev-sl7", email="sl7@x.com")
    user = _make_user(db_session, ev_id="ev-sl7u", email="sl7u@x.com")
    for value in [0, -1]:
        resp = client.patch(
            f"/api/admin/users/{user.id}/limit",
            json={"max_active_jobs": value},
            headers=_auth_header(admin.id),
        )
        assert resp.status_code == 422
