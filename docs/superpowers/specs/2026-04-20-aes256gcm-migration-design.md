# Design: Migration Fernet → AES-256-GCM

Reviewed: 2026-04-20  
**Status:** Abgeschlossen — Migration von Fernet auf AES-256-GCM ist implementiert.

## Kontext

Passwörter werden reversibel verschlüsselt gespeichert, weil der Worker sie zum Login bei Eversports benötigt. Bisher: Fernet (AES-128-CBC + HMAC-SHA256). Ziel: Umstieg auf AES-256-GCM — moderneres AEAD-Verfahren mit 256-Bit-Schlüssel.

## Betroffene Dateien

- `backend/core/encryption.py` — Kern-Implementierung
- `scripts/migrate_passwords.py` — einmaliges Migrationsskript (neu)
- `SECURITY.md` — Dokumentation aktualisieren
- `frontend/src/components/FaqModal.tsx` — FAQ-Antwort aktualisieren

## Umgebungsvariablen

| Variable | Format | Zweck |
|---|---|---|
| `ENCRYPTION_KEY` | 64 Hex-Zeichen (32 Bytes) | Neuer AES-256-GCM-Key |
| `ENCRYPTION_KEY_OLD` | Fernet-Key (44 Base64-Zeichen) | Temporär nur während Migration |

`ENCRYPTION_KEY_OLD` wird nach erfolgreicher Migration entfernt. Neuen Key generieren mit:
```bash
python -c "import os; print(os.urandom(32).hex())"
```

## `backend/core/encryption.py`

Gleiche öffentliche API: `encrypt(plaintext: str) -> str` und `decrypt(ciphertext: str) -> str`.

Intern:
- Key: 32 Bytes aus `ENCRYPTION_KEY` (hex-dekodiert)
- Nonce: 12 zufällige Bytes per `os.urandom(12)` bei jedem `encrypt`-Aufruf
- Algorithmus: AES-256-GCM via `cryptography.hazmat.primitives.ciphers.aead.AESGCM`
- Ciphertext-Format: `hex(nonce || ciphertext_with_tag)` — nonce ist immer 12 Bytes, Tag ist 16 Bytes (von GCM automatisch angehängt)

Kein separates HMAC nötig — GCM liefert Authentizität nativ.

## `scripts/migrate_passwords.py`

Ablauf:
1. Liest `ENCRYPTION_KEY_OLD` (Fernet) und `ENCRYPTION_KEY` (AES-256-GCM) aus Umgebung
2. Öffnet DB-Session via `DATABASE_URL`
3. Iteriert über alle `User`-Datensätze
4. Entschlüsselt `encrypted_password` mit Fernet (alter Key)
5. Verschlüsselt Klartext neu mit AES-256-GCM (neuer Key)
6. Schreibt zurück und committed nach jedem User (sicheres Teilabbruch-Verhalten)
7. Gibt Fortschritt aus (`user@example.com ... OK`)
8. Bricht bei Fehler mit klarer Fehlermeldung ab (kein stilles Überspringen)

Aufruf:
```bash
ENCRYPTION_KEY_OLD=<alter-fernet-key> \
ENCRYPTION_KEY=<neuer-hex-key> \
DATABASE_URL=sqlite:///eversports.db \
python scripts/migrate_passwords.py
```

## `SECURITY.md`

Abschnitt "Bekannte Einschränkung: Passwort-Speicherung" aktualisieren:
- "Fernet" → "AES-256-GCM (AEAD)"
- Schlüssellänge: 256 Bit (32 Bytes)
- Verweis auf `backend/core/encryption.py` bleibt

## `frontend/src/components/FaqModal.tsx`

FAQ-Antwort "Wie werden meine Zugangsdaten gespeichert?" aktualisieren:
- Fernet-spezifische Details entfernen
- AES-256-GCM, 256-Bit-Schlüssel, AEAD (Authentizität + Vertraulichkeit in einem) erwähnen
- Keraussage bleibt: reversibel verschlüsselt, Schlüssel als Umgebungsvariable, kein Klartext in DB

## Nicht im Scope

- Keine DB-Schema-Änderung (`encrypted_password` bleibt `String`)
- Kein Alembic-Migration nötig (nur Dateninhalt ändert sich)
- Kein Key-Rotation-Mechanismus (einmaliger Umstieg)
