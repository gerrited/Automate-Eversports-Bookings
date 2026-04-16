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


def test_first_user_becomes_admin_and_is_active(client, mocker):
    mocker.patch(
        "backend.api.auth.eversports_login",
        return_value={"user_id": "ev-first", "session": None},
    )
    resp = client.post("/api/auth/login", json={"email": "first@x.com", "password": "pw"})
    assert resp.status_code == 200
    body = resp.json()
    assert body["role"] == "admin"


def test_second_user_is_inactive_and_gets_user_role(client, mocker, db_session):
    from backend.models.user import User
    # Pre-create the first user so second registration is not first
    existing = User(
        eversports_user_id="ev-existing",
        email="existing@x.com",
        encrypted_password="x",
        active=True,
        role="admin",
    )
    db_session.add(existing)
    db_session.commit()

    mocker.patch(
        "backend.api.auth.eversports_login",
        return_value={"user_id": "ev-second", "session": None},
    )
    resp = client.post("/api/auth/login", json={"email": "second@x.com", "password": "pw"})
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Account nicht freigegeben"


def test_inactive_user_login_returns_403(client, mocker, db_session):
    from backend.models.user import User
    inactive = User(
        eversports_user_id="ev-inactive",
        email="inactive@x.com",
        encrypted_password="x",
        active=False,
        role="user",
    )
    db_session.add(inactive)
    db_session.commit()

    mocker.patch(
        "backend.api.auth.eversports_login",
        return_value={"user_id": "ev-inactive", "session": None},
    )
    resp = client.post("/api/auth/login", json={"email": "inactive@x.com", "password": "pw"})
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Account nicht freigegeben"


def test_active_user_login_returns_role(client, mocker, db_session):
    from backend.models.user import User
    active_user = User(
        eversports_user_id="ev-active",
        email="active@x.com",
        encrypted_password="x",
        active=True,
        role="user",
    )
    db_session.add(active_user)
    db_session.commit()

    mocker.patch(
        "backend.api.auth.eversports_login",
        return_value={"user_id": "ev-active", "session": None},
    )
    resp = client.post("/api/auth/login", json={"email": "active@x.com", "password": "pw"})
    assert resp.status_code == 200
    assert resp.json()["role"] == "user"


def test_inactive_user_cannot_access_protected_route(client, db_session):
    from backend.core.auth import create_access_token
    from backend.models.user import User
    inactive = User(
        eversports_user_id="ev-blocked",
        email="blocked@x.com",
        encrypted_password="x",
        active=False,
        role="user",
    )
    db_session.add(inactive)
    db_session.commit()
    db_session.refresh(inactive)

    headers = {"Authorization": f"Bearer {create_access_token(inactive.id)}"}
    resp = client.get("/api/jobs", headers=headers)
    assert resp.status_code == 403


# --- email notifications ---

def test_new_user_registration_sends_admin_notification(client, mocker, db_session):
    from backend.models.user import User
    # Pre-create an active admin
    admin = User(
        eversports_user_id="ev-admin",
        email="admin@x.com",
        encrypted_password="x",
        active=True,
        role="admin",
    )
    db_session.add(admin)
    db_session.commit()

    mocker.patch(
        "backend.api.auth.eversports_login",
        return_value={"user_id": "ev-newuser", "session": None},
    )
    mock_notify = mocker.patch("backend.api.auth.send_new_user_notification")

    client.post("/api/auth/login", json={"email": "newuser@x.com", "password": "pw"})

    mock_notify.assert_called_once_with(["admin@x.com"], "newuser@x.com")


def test_first_user_registration_does_not_send_notification(client, mocker):
    mocker.patch(
        "backend.api.auth.eversports_login",
        return_value={"user_id": "ev-first2", "session": None},
    )
    mock_notify = mocker.patch("backend.api.auth.send_new_user_notification")

    client.post("/api/auth/login", json={"email": "first@x.com", "password": "pw"})

    mock_notify.assert_not_called()


def test_existing_user_login_does_not_send_notification(client, mocker, db_session):
    from backend.models.user import User
    existing = User(
        eversports_user_id="ev-exists",
        email="exists@x.com",
        encrypted_password="x",
        active=True,
        role="user",
    )
    db_session.add(existing)
    db_session.commit()

    mocker.patch(
        "backend.api.auth.eversports_login",
        return_value={"user_id": "ev-exists", "session": None},
    )
    mock_notify = mocker.patch("backend.api.auth.send_new_user_notification")

    client.post("/api/auth/login", json={"email": "exists@x.com", "password": "pw"})

    mock_notify.assert_not_called()


def test_login_succeeds_even_if_notification_fails(client, mocker, db_session):
    from backend.models.user import User
    admin = User(
        eversports_user_id="ev-admin2",
        email="admin2@x.com",
        encrypted_password="x",
        active=True,
        role="admin",
    )
    db_session.add(admin)
    db_session.commit()

    mocker.patch(
        "backend.api.auth.eversports_login",
        return_value={"user_id": "ev-failmail", "session": None},
    )
    mocker.patch(
        "backend.api.auth.send_new_user_notification",
        side_effect=Exception("Resend down"),
    )

    # Should still return 403 (inactive), not 500
    resp = client.post("/api/auth/login", json={"email": "failmail@x.com", "password": "pw"})
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Account nicht freigegeben"
