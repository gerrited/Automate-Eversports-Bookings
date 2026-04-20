import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def _key() -> bytes:
    return bytes.fromhex(os.environ["ENCRYPTION_KEY"])


def encrypt(plaintext: str) -> str:
    nonce = os.urandom(12)
    ct = AESGCM(_key()).encrypt(nonce, plaintext.encode(), None)
    return (nonce + ct).hex()


def decrypt(ciphertext: str) -> str:
    data = bytes.fromhex(ciphertext)
    nonce, ct = data[:12], data[12:]
    return AESGCM(_key()).decrypt(nonce, ct, None).decode()
