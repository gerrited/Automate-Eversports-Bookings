import os
from cryptography.fernet import Fernet

os.environ.setdefault("ENCRYPTION_KEY", Fernet.generate_key().decode())
os.environ.setdefault("JWT_SECRET", "test-jwt-secret-do-not-use-in-prod")
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("FRONTEND_URL", "http://localhost:5173")

from backend.core.auth import create_access_token
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
