import os
from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _key() -> bytes:
    return bytes.fromhex(os.environ["ENCRYPTION_KEY"])


def encrypt(plaintext: str, *, aad: str) -> str:
    """Verschlüsselt mit AES-256-GCM, gebunden an `aad` (eversports_user_id).

    Die AAD verhindert, dass Ciphertexte zwischen Nutzerzeilen getauscht werden.
    """
    nonce = os.urandom(12)
    ct = AESGCM(_key()).encrypt(nonce, plaintext.encode(), aad.encode())
    return (nonce + ct).hex()


def decrypt(ciphertext: str, *, aad: str) -> str:
    data = bytes.fromhex(ciphertext)
    nonce, ct = data[:12], data[12:]
    try:
        return AESGCM(_key()).decrypt(nonce, ct, aad.encode()).decode()
    except InvalidTag:
        # Bestandsdaten von vor der AAD-Einführung; beim nächsten Login
        # wird das Passwort mit AAD neu verschlüsselt.
        return AESGCM(_key()).decrypt(nonce, ct, None).decode()
