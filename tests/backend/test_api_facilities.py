from datetime import time
from unittest.mock import patch

from backend.core.auth import create_access_token
from backend.models.booking_job import BookingJob
from backend.models.user import User


def _auth_header(user_id: str) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


def _create_user(db_session, email="a@b.com") -> User:
    user = User(eversports_user_id="ev-1", email=email, encrypted_password="x", active=True)
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


def _create_job(db_session, user_id, facility_id, facility_name) -> BookingJob:
    job = BookingJob(
        user_id=user_id,
        weekday=1,
        target_time=time(18, 0),
        facility_id=facility_id,
        facility_name=facility_name,
        class_name="CrossFit",
        days_in_advance=4,
    )
    db_session.add(job)
    db_session.commit()
    db_session.refresh(job)
    return job


def test_recent_facilities_empty(client, db_session):
    user = _create_user(db_session)
    resp = client.get("/api/facilities/recent", headers=_auth_header(user.id))
    assert resp.status_code == 200
    assert resp.json() == []


def test_recent_facilities_returns_last_5_distinct(client, db_session):
    user = _create_user(db_session)
    for _ in range(3):
        _create_job(db_session, user.id, "111", "Gym A")
    _create_job(db_session, user.id, "222", "Gym B")
    _create_job(db_session, user.id, "333", "Gym C")
    _create_job(db_session, user.id, "444", "Gym D")
    _create_job(db_session, user.id, "555", "Gym E")
    _create_job(db_session, user.id, "666", "Gym F")

    resp = client.get("/api/facilities/recent", headers=_auth_header(user.id))
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 5
    ids = [f["id"] for f in data]
    assert "666" in ids
    assert "111" not in ids
    for item in data:
        assert "id" in item
        assert "name" in item


def test_recent_facilities_isolated_per_user(client, db_session):
    user_a = _create_user(db_session, "a@b.com")
    user_b = User(eversports_user_id="ev-2", email="b@b.com", encrypted_password="x", active=True)
    db_session.add(user_b)
    db_session.commit()
    db_session.refresh(user_b)

    _create_job(db_session, user_a.id, "111", "Gym A")
    resp = client.get("/api/facilities/recent", headers=_auth_header(user_b.id))
    assert resp.json() == []


def test_recent_facilities_requires_auth(client, db_session):
    resp = client.get("/api/facilities/recent")
    assert resp.status_code == 401


def test_search_facilities_rejects_short_query(client, db_session):
    user = _create_user(db_session)
    resp = client.get("/api/facilities/search?q=abc", headers=_auth_header(user.id))
    assert resp.status_code == 422


def test_search_facilities_requires_auth(client, db_session):
    resp = client.get("/api/facilities/search?q=crossfit")
    assert resp.status_code == 401


def test_search_facilities_returns_results(client, db_session):
    user = _create_user(db_session)
    mock_response = [{"id": "99999", "name": "CrossFit Berlin"}]

    with patch("backend.api.facilities._eversports_search", return_value=mock_response):
        resp = client.get(
            "/api/facilities/search?q=crossfit",
            headers=_auth_header(user.id),
        )

    assert resp.status_code == 200
    assert resp.json() == [{"id": "99999", "name": "CrossFit Berlin"}]


def test_search_facilities_propagates_eversports_error(client, db_session):
    user = _create_user(db_session)

    with patch("backend.api.facilities._eversports_search", side_effect=RuntimeError("timeout")):
        resp = client.get(
            "/api/facilities/search?q=crossfit",
            headers=_auth_header(user.id),
        )

    assert resp.status_code == 502
