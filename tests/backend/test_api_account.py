import datetime

from backend.core.auth import create_access_token
from backend.models.booking_job import BookingJob
from backend.models.booking_log import BookingLog
from backend.models.user import User


def _auth_header(user_id: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _create_active_user(db_session, email: str = "user@example.com", eversports_id: str = "ev-1") -> User:
    user = User(eversports_user_id=eversports_id, email=email, encrypted_password="x", active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _create_job(db_session, user_id: str) -> BookingJob:
    job = BookingJob(
        user_id=user_id,
        weekday=1,
        target_time=datetime.time(18, 0),
        facility_id="73041",
        facility_name="CrossFit Rabbit Hole",
        class_name="CrossFit",
        days_in_advance=4,
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)
    return job


def _create_log(db_session, job_id: str) -> BookingLog:
    log = BookingLog(
        job_id=job_id,
        executed_at=datetime.datetime.now(datetime.timezone.utc),
        target_date=datetime.date.today(),
        status="success",
    )
    db_session.add(log)
    db_session.commit()
    db_session.refresh(log)
    return log


def test_delete_account_returns_204(client, db_session):
    user = _create_active_user(db_session)
    resp = client.delete("/api/account", headers=_auth_header(user.id))
    assert resp.status_code == 204


def test_delete_account_removes_user_from_db(client, db_session):
    user = _create_active_user(db_session)
    client.delete("/api/account", headers=_auth_header(user.id))
    assert db_session.get(User, user.id) is None


def test_delete_account_cascades_to_jobs_and_logs(client, db_session):
    user = _create_active_user(db_session)
    job = _create_job(db_session, user.id)
    log = _create_log(db_session, job.id)

    client.delete("/api/account", headers=_auth_header(user.id))

    db_session.expire_all()
    assert db_session.get(BookingJob, job.id) is None
    assert db_session.get(BookingLog, log.id) is None


def test_delete_account_without_token_returns_401(client):
    resp = client.delete("/api/account")
    assert resp.status_code == 401


def test_delete_account_inactive_user_returns_403(client, db_session):
    inactive = User(
        eversports_user_id="ev-inactive",
        email="inactive@example.com",
        encrypted_password="x",
        active=False,
    )
    db_session.add(inactive)
    db_session.commit()
    db_session.refresh(inactive)

    resp = client.delete("/api/account", headers=_auth_header(inactive.id))
    assert resp.status_code == 403


def test_delete_account_only_deletes_own_data(client, db_session):
    user_a = _create_active_user(db_session, email="a@example.com", eversports_id="ev-a")
    user_b = _create_active_user(db_session, email="b@example.com", eversports_id="ev-b")
    job_b = _create_job(db_session, user_b.id)

    client.delete("/api/account", headers=_auth_header(user_a.id))

    db_session.expire_all()
    assert db_session.get(User, user_b.id) is not None
    assert db_session.get(BookingJob, job_b.id) is not None


def test_get_me_without_subscription(client, db_session):
    user = _create_active_user(db_session)
    user.max_active_jobs = 1
    db_session.commit()
    resp = client.get("/api/me", headers=_auth_header(user.id))
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "user@example.com"
    assert data["role"] == "user"
    assert data["subscription_active"] is False


def test_get_me_with_subscription(client, db_session):
    user = _create_active_user(db_session)
    user.max_active_jobs = None
    db_session.commit()
    resp = client.get("/api/me", headers=_auth_header(user.id))
    assert resp.status_code == 200
    data = resp.json()
    assert data["subscription_active"] is True


def test_get_me_without_token_returns_401(client):
    resp = client.get("/api/me")
    assert resp.status_code == 401
