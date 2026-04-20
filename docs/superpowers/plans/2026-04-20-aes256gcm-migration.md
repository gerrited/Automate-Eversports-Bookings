# AES-256-GCM Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Passwörter von Fernet (AES-128-CBC+HMAC) auf AES-256-GCM umstellen und alle betroffenen Dateien (Encryption, Tests, Migrationsskript, Docs) aktualisieren.

**Architecture:** Gleiche öffentliche API (`encrypt`/`decrypt`), intern AES-256-GCM mit zufälligem 12-Byte-Nonce. Ciphertext-Format: `hex(nonce || ct_with_tag)`. Migrationsskript re-verschlüsselt alle User-Passwörter in DB.

**Tech Stack:** Python, `cryptography` (bereits installiert), SQLAlchemy, pytest, TypeScript/React

---

## File Map

| Datei | Änderung |
|---|---|
| `backend/core/encryption.py` | Fernet → AESGCM |
| `tests/backend/test_encryption.py` | InvalidToken → InvalidTag, Testlogik anpassen |
| `tests/backend/conftest.py` | Fernet-Keygenerierung → hex |
| `tests/worker/conftest.py` | Fernet-Keygenerierung → hex |
| `scripts/migrate_passwords.py` | Neu erstellen |
| `SECURITY.md` | Fernet → AES-256-GCM |
| `frontend/src/components/FaqModal.tsx` | FAQ-Antwort aktualisieren |

---

## Task 1: Test-Infrastruktur aktualisieren (conftest-Dateien)

Beide conftest-Dateien generieren aktuell einen Fernet-Key für `ENCRYPTION_KEY`. Nach der Umstellung brauchen sie einen 32-Byte-Hex-String.

**Files:**
- Modify: `tests/backend/conftest.py:1-5`
- Modify: `tests/worker/conftest.py:1-4`

- [ ] **Step 1: `tests/backend/conftest.py` anpassen**

Ersetze:
```python
import os
from cryptography.fernet import Fernet

# Must be set before any backend module is imported
os.environ.setdefault("ENCRYPTION_KEY", Fernet.generate_key().decode())
```

Mit:
```python
import os

# Must be set before any backend module is imported
os.environ.setdefault("ENCRYPTION_KEY", os.urandom(32).hex())
```

- [ ] **Step 2: `tests/worker/conftest.py` anpassen**

Ersetze:
```python
import os
from cryptography.fernet import Fernet

os.environ.setdefault("ENCRYPTION_KEY", Fernet.generate_key().decode())
```

Mit:
```python
import os

os.environ.setdefault("ENCRYPTION_KEY", os.urandom(32).hex())
```

- [ ] **Step 3: Commit**

```bash
git add tests/backend/conftest.py tests/worker/conftest.py
git commit -m "test: update conftest to generate AES-256-GCM compatible key"
```

---

## Task 2: Encryption-Tests aktualisieren (TDD)

Die bestehenden Tests passen die API korrekt ab, aber `InvalidToken` (Fernet) muss durch `InvalidTag` (GCM) ersetzt werden. Tests sollen **vor** der neuen Implementierung fehlschlagen.

**Files:**
- Modify: `tests/backend/test_encryption.py`

- [ ] **Step 1: Test-Datei ersetzen**

Inhalt von `tests/backend/test_encryption.py` komplett ersetzen:

```python
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
```

- [ ] **Step 2: Tests ausführen — müssen jetzt FEHLSCHLAGEN**

```bash
pytest tests/backend/test_encryption.py -v
```

Erwartet: `FAILED` bei `test_decrypt_tampered_raises` (weil Fernet `InvalidToken` wirft, nicht `InvalidTag`) und ggf. andere Fehler wegen Key-Format-Mismatch.

- [ ] **Step 3: Commit**

```bash
git add tests/backend/test_encryption.py
git commit -m "test: update encryption tests for AES-256-GCM (red)"
```

---

## Task 3: `backend/core/encryption.py` implementieren

**Files:**
- Modify: `backend/core/encryption.py`

- [ ] **Step 1: Implementierung ersetzen**

Vollständiger neuer Inhalt von `backend/core/encryption.py`:

```python
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
```

- [ ] **Step 2: Encryption-Tests ausführen — müssen GRÜN sein**

```bash
pytest tests/backend/test_encryption.py -v
```

Erwartet: alle 4 Tests `PASSED`.

- [ ] **Step 3: Gesamte Test-Suite ausführen**

```bash
pytest tests/ -x
```

Erwartet: alle Tests grün. Falls Tests fehlschlagen, die `encrypt`/`decrypt` indirekt nutzen (z.B. via Worker oder API), liegt es am Key-Format — prüfen ob conftest korrekt angepasst wurde (Task 1).

- [ ] **Step 4: Commit**

```bash
git add backend/core/encryption.py
git commit -m "feat: replace Fernet with AES-256-GCM in encryption module"
```

---

## Task 4: Migrationsskript erstellen

Das Skript re-verschlüsselt alle User-Passwörter von Fernet (alter Key) zu AES-256-GCM (neuer Key). Es läuft einmalig manuell.

**Files:**
- Create: `scripts/migrate_passwords.py`

- [ ] **Step 1: `scripts/` Verzeichnis anlegen und Skript erstellen**

```bash
mkdir -p scripts
```

Inhalt von `scripts/migrate_passwords.py`:

```python
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
```

- [ ] **Step 2: Skript manuell testen (Dry-Run-Prüfung)**

Einen Test-Key generieren und prüfen ob das Skript bei leerer DB sauber durchläuft:

```bash
NEW_KEY=$(python -c "import os; print(os.urandom(32).hex())")
OLD_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")

ENCRYPTION_KEY_OLD=$OLD_KEY \
ENCRYPTION_KEY=$NEW_KEY \
DATABASE_URL=sqlite:///eversports.db \
python scripts/migrate_passwords.py
```

Erwartet: `Migriere 0 User...` (oder Anzahl lokaler User) + `Migration abgeschlossen.`

- [ ] **Step 3: Commit**

```bash
git add scripts/migrate_passwords.py
git commit -m "feat: add password migration script for Fernet → AES-256-GCM"
```

---

## Task 5: `SECURITY.md` aktualisieren

**Files:**
- Modify: `SECURITY.md:27-35`

- [ ] **Step 1: Abschnitt "Bekannte Einschränkung" ersetzen**

Den Abschnitt ab `**Implementierung:**` ersetzen:

Alt:
```markdown
**Implementierung:** Passwörter werden symmetrisch mit Fernet verschlüsselt (`backend/core/encryption.py`). Der Schlüssel kommt aus einer Umgebungsvariable.
```

Neu:
```markdown
**Implementierung:** Passwörter werden symmetrisch mit AES-256-GCM (AEAD) verschlüsselt (`backend/core/encryption.py`). Der 256-Bit-Schlüssel (32 Bytes) kommt aus der Umgebungsvariable `ENCRYPTION_KEY`. Jede Verschlüsselung verwendet einen zufälligen 12-Byte-Nonce; Authentizität und Vertraulichkeit werden durch GCM nativ garantiert — kein separates HMAC erforderlich.
```

- [ ] **Step 2: Commit**

```bash
git add SECURITY.md
git commit -m "docs(security): update encryption description to AES-256-GCM"
```

---

## Task 6: `FaqModal.tsx` aktualisieren

**Files:**
- Modify: `frontend/src/components/FaqModal.tsx:19-21`

- [ ] **Step 1: FAQ-Antwort zur Passwort-Speicherung ersetzen**

Die `answer`-Property des FAQ-Items "Wie werden meine Zugangsdaten gespeichert?" ersetzen:

Alt:
```
'Dein Eversports-Passwort wird mit Fernet symmetrisch verschlüsselt und ausschließlich in verschlüsselter Form in der Datenbank abgelegt – nie im Klartext. Fernet verwendet intern AES-128-CBC zur Verschlüsselung kombiniert mit HMAC-SHA256 zur Integritätsprüfung (Encrypt-then-MAC). AES-128 ist dabei nicht frei wählbar – es ist im Fernet-Standard fest vorgegeben. AES-128 gilt nach aktuellem Stand als rechnerisch sicher; ohne HMAC wäre CBC allein manipulierbar, weshalb beides kombiniert wird. Der 32-Byte-Schlüssel (je 16 Byte für HMAC und AES) wird serverseitig als Umgebungsvariable verwaltet und ist nicht Teil der Datenbank. Zum Durchführen einer Buchung wird das Passwort temporär entschlüsselt und direkt an die Eversports-API übergeben – es verlässt den Server dabei nicht.'
```

Neu:
```
'Dein Eversports-Passwort wird mit AES-256-GCM verschlüsselt und ausschließlich in verschlüsselter Form in der Datenbank abgelegt – nie im Klartext. AES-256-GCM ist ein modernes AEAD-Verfahren (Authenticated Encryption with Associated Data): Es garantiert gleichzeitig Vertraulichkeit und Integrität, ohne ein separates HMAC zu benötigen. Der 256-Bit-Schlüssel wird serverseitig als Umgebungsvariable verwaltet und ist nicht Teil der Datenbank. Zum Durchführen einer Buchung wird das Passwort temporär entschlüsselt und direkt an die Eversports-API übergeben – es verlässt den Server dabei nicht.'
```

- [ ] **Step 2: Frontend-Tests ausführen**

```bash
cd frontend && npx vitest run src/components/FaqModal.test.tsx
```

Erwartet: alle Tests grün (reine Snapshot/Render-Tests, keine Abhängigkeit vom Verschlüsselungstext).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/FaqModal.tsx
git commit -m "docs(faq): update password storage answer to AES-256-GCM"
```

---

## Abschluss: Produktions-Migration

Nach dem Deployment diese Schritte in der Produktionsumgebung ausführen:

```bash
# 1. Neuen Key generieren
NEW_KEY=$(python -c "import os; print(os.urandom(32).hex())")
echo "Neuer ENCRYPTION_KEY: $NEW_KEY"

# 2. Umgebungsvariablen setzen (alter Key aus bisheriger ENCRYPTION_KEY-Variable)
ENCRYPTION_KEY_OLD=<bisheriger-fernet-key> \
ENCRYPTION_KEY=$NEW_KEY \
DATABASE_URL=<production-db-url> \
python scripts/migrate_passwords.py

# 3. ENCRYPTION_KEY in der Produktionsumgebung auf $NEW_KEY setzen
# 4. ENCRYPTION_KEY_OLD entfernen
# 5. App neu starten
```
