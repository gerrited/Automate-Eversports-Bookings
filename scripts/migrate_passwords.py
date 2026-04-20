import os
import sys

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.models.user import User


def _fernet_decrypt(old_key: str, ciphertext: str) -> str:
    return Fernet(old_key.encode()).decrypt(ciphertext.encode()).decode()


def _aes_encrypt(new_key_hex: str, plaintext: str) -> str:
    key = bytes.fromhex(new_key_hex)
    nonce = os.urandom(12)
    ct = AESGCM(key).encrypt(nonce, plaintext.encode(), None)
    return (nonce + ct).hex()


def main() -> None:
    old_key = os.environ["ENCRYPTION_KEY_OLD"]
    new_key = os.environ["ENCRYPTION_KEY"]
    db_url = os.environ["DATABASE_URL"]

    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)

    with Session() as session:
        users = session.query(User).all()
        print(f"Migriere {len(users)} User...")
        for user in users:
            try:
                plaintext = _fernet_decrypt(old_key, user.encrypted_password)
                user.encrypted_password = _aes_encrypt(new_key, plaintext)
                session.commit()
                print(f"  {user.email} ... OK")
            except Exception as exc:
                session.rollback()
                print(f"  {user.email} ... FEHLER: {exc}", file=sys.stderr)
                sys.exit(1)
    print("Migration abgeschlossen.")


if __name__ == "__main__":
    main()
