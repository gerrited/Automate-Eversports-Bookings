from backend.core.auth import (
    create_access_token,
    create_refresh_token,
    verify_token,
    verify_refresh_token,
    JWTError,
)
import pytest


def test_create_and_verify_token():
    user_id = "user-123"
    token = create_access_token(user_id)
    assert verify_token(token) == user_id


def test_verify_invalid_token_raises():
    with pytest.raises(JWTError):
        verify_token("not.a.valid.token")


def test_verify_tampered_token_raises():
    token = create_access_token("user-abc")
    tampered = token[:-5] + "XXXXX"
    with pytest.raises(JWTError):
        verify_token(tampered)


def test_access_token_has_type_claim():
    import jwt, os
    token = create_access_token("user-1")
    payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])
    assert payload["type"] == "access"


def test_refresh_token_has_type_claim():
    import jwt, os
    token = create_refresh_token("user-1")
    payload = jwt.decode(token, os.environ["JWT_SECRET"], algorithms=["HS256"])
    assert payload["type"] == "refresh"


def test_verify_token_rejects_refresh_token():
    token = create_refresh_token("user-1")
    with pytest.raises(JWTError):
        verify_token(token)


def test_verify_refresh_token_rejects_access_token():
    token = create_access_token("user-1")
    with pytest.raises(JWTError):
        verify_refresh_token(token)


def test_create_and_verify_refresh_token():
    token = create_refresh_token("user-42")
    assert verify_refresh_token(token) == "user-42"
