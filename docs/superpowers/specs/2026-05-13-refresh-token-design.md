# Refresh Token — Design Spec

**Datum:** 2026-05-13  
**Status:** Approved

## Ziel

Kurze Access Tokens (15 min) kombiniert mit langen Sessions (90 Tage) ohne manuellen Re-Login. Nutzer bleiben dauerhaft eingeloggt, solange sie innerhalb von 90 Tagen aktiv sind.

## Token-Konzept

Zwei separate JWTs, beide signiert mit dem bestehenden `JWT_SECRET`:

| | Access Token | Refresh Token |
|---|---|---|
| Lebensdauer | 15 Minuten | 90 Tage |
| Speicherort | `localStorage` | httpOnly Cookie |
| JWT-Claim `type` | `"access"` | `"refresh"` |
| Übertragung | `Authorization: Bearer` Header | automatisch als Cookie |

Der `type`-Claim verhindert den Missbrauch eines Refresh Tokens als Access Token und umgekehrt. `verify_token()` prüft diesen Claim.

## Backend-Änderungen

### `backend/core/auth.py`

- Access Token Lebensdauer: 24h → 15 min
- `create_access_token()` setzt `type: "access"` im Payload
- Neue Funktion `create_refresh_token(user_id)`: JWT mit 90 Tagen Lebensdauer, `type: "refresh"`
- `verify_token()` prüft `type == "access"`, wirft `JWTError` bei falschem Typ
- Neue Funktion `verify_refresh_token(token)`: prüft `type == "refresh"`

### `backend/api/auth.py`

**Login (`POST /api/auth/login`):**
- Unveränderter Response Body mit `access_token`, `role`, `avatar_url`
- Zusätzlich: httpOnly Cookie `refresh_token` wird gesetzt

**Neuer Endpoint `POST /api/auth/refresh`:**
- Liest `refresh_token` aus dem Cookie
- Verifiziert via `verify_refresh_token()`
- Lädt User aus DB, prüft `user.active`
- Bei Erfolg: gibt `{ access_token: string }` zurück (kein `role`/`avatar_url` — die liegen bereits im Frontend)
- Gibt keinen neuen Refresh Token zurück (stateless, keine Rotation)

**Neuer Endpoint `POST /api/auth/logout`:**
- Setzt `Set-Cookie: refresh_token=; Path=/api/auth/refresh; Max-Age=0` im Response-Header
- Der Browser sendet den Cookie nicht zu diesem Endpoint (falscher Path), aber der Server kann ihn trotzdem per Response-Header löschen
- Gibt 204 zurück

### `backend/main.py`

CORS-Konfiguration:
- `allow_credentials=True`
- `allow_origins=[FRONTEND_URL]` (explizit, kein Wildcard `*`)

## Cookie-Attribute

```
HttpOnly; Secure; SameSite=Strict; Path=/api/auth/refresh; Max-Age=7776000
```

- `HttpOnly`: kein JavaScript-Zugriff (kein XSS-Risiko)
- `Secure`: nur über HTTPS
- `SameSite=Strict`: kein CSRF-Risiko
- `Path=/api/auth/refresh`: Cookie wird nur an diesen Endpoint gesendet, alle anderen Requests bleiben schlank

## Frontend-Änderungen

### `frontend/src/api/client.ts`

- Alle `fetch`-Calls: `credentials: 'include'` damit der Cookie mitgesendet wird
- Bei 401: einmalig `POST /api/auth/refresh` aufrufen
  - Erfolg: neuen Access Token in `localStorage` speichern, Original-Request wiederholen
  - Misserfolg (401/403): `clearToken()` + `window.location.href = '/'`
- Kein Deduplication-Mechanismus nötig (stateless Refresh, parallele Requests sind harmlos)

### `frontend/src/api/auth.ts`

- `logout()`: ruft `POST /api/auth/logout` auf (löscht Cookie serverseitig), danach `clearToken()`

## Fehlerbehandlung

| Szenario | Verhalten |
|---|---|
| Access Token abgelaufen | 401 → Refresh → Retry |
| Refresh Token abgelaufen (90 Tage) | 401 auf /refresh → ausloggen |
| Account deaktiviert | 403 auf /refresh → ausloggen |
| Refresh schlägt fehl | kein Re-Retry, direkt ausloggen |

## Nicht im Scope

- Serverseitige Token-Revocation (bewusst ausgeschlossen, stateless)
- Refresh Token Rotation
- Mehrere gleichzeitige Geräte/Sessions werden nicht verwaltet
