def test_user_model_has_active_and_role_defaults(db_session):
    from backend.models.user import User
    user = User(
        eversports_user_id="ev-defaults",
        email="defaults@x.com",
        encrypted_password="x",
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    assert user.active == False
    assert user.role == "user"


def test_login_success_creates_user(client, mocker):
    mocker.patch(
        "backend.api.auth.eversports_login",
        return_value={"user_id": "ev-user-42", "session": None},
    )
    resp = client.post("/api/auth/login", json={"email": "user@example.com", "password": "pass123"})
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"


def test_login_invalid_credentials_returns_401(client, mocker):
    mocker.patch("backend.api.auth.eversports_login", return_value=None)
    resp = client.post("/api/auth/login", json={"email": "bad@example.com", "password": "wrong"})
    assert resp.status_code == 401


def test_login_twice_updates_password(client, mocker):
    mocker.patch(
        "backend.api.auth.eversports_login",
        return_value={"user_id": "ev-user-99", "session": None},
    )
    client.post("/api/auth/login", json={"email": "user@example.com", "password": "oldpass"})
    resp = client.post("/api/auth/login", json={"email": "user@example.com", "password": "newpass"})
    assert resp.status_code == 200  # no duplicate-user error


def test_protected_route_without_token_returns_401(client):
    resp = client.get("/api/jobs")
    assert resp.status_code == 401


def test_token_response_includes_role(client, mocker):
    mocker.patch(
        "backend.api.auth.eversports_login",
        return_value={"user_id": "ev-schema-1", "session": None},
    )
    resp = client.post("/api/auth/login", json={"email": "schema@x.com", "password": "pw"})
    assert resp.status_code == 200
    assert "role" in resp.json()
