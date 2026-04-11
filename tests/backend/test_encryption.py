from backend.core.encryption import encrypt, decrypt


def test_encrypt_returns_different_from_plaintext():
    ciphertext = encrypt("mysecret")
    assert ciphertext != "mysecret"


def test_decrypt_roundtrip():
    plaintext = "my-eversports-password-123"
    assert decrypt(encrypt(plaintext)) == plaintext


def test_encrypt_produces_different_tokens_each_time():
    # Fernet uses random IV, so two encryptions of the same value differ
    assert encrypt("same") != encrypt("same")


def test_decrypt_wrong_value_raises():
    import pytest
    from cryptography.fernet import InvalidToken
    with pytest.raises(InvalidToken):
        decrypt("not-valid-ciphertext")
