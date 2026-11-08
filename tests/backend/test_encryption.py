import os

import pytest
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from backend.core.encryption import encrypt, decrypt


def test_encrypt_returns_different_from_plaintext():
    assert encrypt("mysecret", aad="ev-1") != "mysecret"


def test_decrypt_roundtrip():
    plaintext = "my-eversports-password-123"
    assert decrypt(encrypt(plaintext, aad="ev-1"), aad="ev-1") == plaintext


def test_encrypt_produces_different_ciphertexts_each_time():
    # Zufälliger Nonce pro Aufruf, daher immer unterschiedlich
    assert encrypt("same", aad="ev-1") != encrypt("same", aad="ev-1")


def test_decrypt_tampered_raises():
    ct = encrypt("secret", aad="ev-1")
    # Letztes Zeichen kippen → GCM-Tag-Verifikation schlägt fehl
    tampered = ct[:-1] + ("0" if ct[-1] != "0" else "1")
    with pytest.raises(InvalidTag):
        decrypt(tampered, aad="ev-1")


def test_decrypt_mit_falscher_aad_schlaegt_fehl():
    # Ciphertext ist an den Nutzer gebunden — zwischen Zeilen tauschen geht nicht
    ct = encrypt("secret", aad="ev-user-a")
    with pytest.raises(InvalidTag):
        decrypt(ct, aad="ev-user-b")


def test_decrypt_legacy_ciphertext_ohne_aad_funktioniert():
    # Bestandsdaten wurden vor Einführung der AAD ohne sie verschlüsselt —
    # decrypt muss auf den Legacy-Modus zurückfallen.
    key = bytes.fromhex(os.environ["ENCRYPTION_KEY"])
    nonce = os.urandom(12)
    legacy_ct = (nonce + AESGCM(key).encrypt(nonce, b"old-password", None)).hex()
    assert decrypt(legacy_ct, aad="ev-1") == "old-password"
