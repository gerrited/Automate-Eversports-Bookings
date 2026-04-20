import pytest
from cryptography.exceptions import InvalidTag

from backend.core.encryption import encrypt, decrypt


def test_encrypt_returns_different_from_plaintext():
    assert encrypt("mysecret") != "mysecret"


def test_decrypt_roundtrip():
    plaintext = "my-eversports-password-123"
    assert decrypt(encrypt(plaintext)) == plaintext


def test_encrypt_produces_different_ciphertexts_each_time():
    # Zufälliger Nonce pro Aufruf, daher immer unterschiedlich
    assert encrypt("same") != encrypt("same")


def test_decrypt_tampered_raises():
    ct = encrypt("secret")
    # Letztes Zeichen kippen → GCM-Tag-Verifikation schlägt fehl
    tampered = ct[:-1] + ("0" if ct[-1] != "0" else "1")
    with pytest.raises(InvalidTag):
        decrypt(tampered)
