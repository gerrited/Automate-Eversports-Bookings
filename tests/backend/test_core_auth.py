from backend.core.auth import create_access_token, verify_token
from jose import JWTError
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
