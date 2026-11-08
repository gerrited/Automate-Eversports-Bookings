# Security Assessment

Reviewed: 2026-06-09

## Endpoint-Sicherheit

Alle API-Endpunkte sind durch serverseitige Authentifizierung geschützt. Es gibt keine öffentlich erreichbaren Endpunkte außer `POST /api/auth/login`.

| Endpunkt | Schutz |
|---|---|
| `POST /api/auth/login` | öffentlich (Eversports-Credentials werden validiert), Rate-Limit 10 Versuche / 5 Min pro IP |
| `GET /api/calendar/feed.ics` | öffentlich mit Capability-Token (`calendar_token`, UUID4); Antwort wird 15 Min pro Nutzer gecacht |
| `GET/POST /api/jobs` | JWT + aktiver Account |
| `PUT/PATCH/DELETE /api/jobs/{id}` | JWT + aktiver Account + Ownership-Prüfung |
| `GET /api/jobs/{id}/logs` | JWT + aktiver Account + Ownership-Prüfung |
| `GET /api/facilities/*` | JWT + aktiver Account |
| `DELETE /api/account` | JWT + aktiver Account |
| `GET/PATCH /api/admin/*` | JWT + aktiver Account + Admin-Rolle |

**Ownership-Prüfung:** `_get_owned_job()` in `backend/api/jobs.py` stellt sicher, dass Nutzer nur ihre eigenen Jobs lesen und bearbeiten können. Admin-Endpunkte sind durch `require_admin` serverseitig abgesichert.

**CORS:** `allow_origins` ist korrekt auf `FRONTEND_URL` eingeschränkt. Wildcard-Werte bei `allow_methods` und `allow_headers` sind bei fixem Origin kein Sicherheitsproblem.

**Datenbankabfragen:** SQLAlchemy ORM wird durchgehend verwendet — kein raw SQL, kein Injection-Risiko.

**Rollenprüfung:** Die `role` aus dem Frontend-`localStorage` dient ausschließlich der UI-Darstellung. Alle sicherheitsrelevanten Entscheidungen (Admin-Zugriff, Deaktivierung von Accounts) werden serverseitig in `deps.py` getroffen.

## Token-Handling

**Access-Token:** Kurzlebiges JWT (15 Min), liegt im `localStorage` und wird als `Authorization: Bearer` gesendet.

**Refresh-Token:** Langlebiges JWT (90 Tage), liegt **ausschließlich** in einem `httpOnly`/`secure`/`SameSite=Lax`-Cookie mit Pfadbeschränkung auf `/api/auth/refresh`. Es wird weder im Login-Response-Body zurückgegeben noch im `localStorage` gespeichert und ist damit per XSS nicht exfiltrierbar. Der Refresh-Endpoint akzeptiert nur das Cookie.

**Bekannte Einschränkung:** Refresh-Tokens sind stateless und nicht einzeln widerrufbar; eine Deaktivierung des Accounts greift beim nächsten Refresh (spätestens nach 15 Min Access-Token-Laufzeit).

## Bekannte Einschränkung: Passwort-Speicherung

**Kontext:** Das System muss sich periodisch automatisch bei Eversports einloggen. Passwörter müssen daher reversibel gespeichert werden — Hashing ist nicht möglich.

**Implementierung:** Passwörter werden symmetrisch mit AES-256-GCM (AEAD) verschlüsselt (`backend/core/encryption.py`). Der 256-Bit-Schlüssel (32 Bytes) kommt aus der Umgebungsvariable `ENCRYPTION_KEY`. Jede Verschlüsselung verwendet einen zufälligen 12-Byte-Nonce; Authentizität und Vertraulichkeit werden durch GCM nativ garantiert — kein separates HMAC erforderlich. Als Associated Data (AAD) wird die `eversports_user_id` mitgebunden — Ciphertexte können nicht zwischen Nutzerzeilen getauscht werden. Bestandsdaten von vor der AAD-Einführung werden per Fallback entschlüsselt und beim nächsten Login mit AAD neu verschlüsselt.

**Risiko:** Wer sowohl Datenbankinhalt als auch den Verschlüsselungsschlüssel kompromittiert, kann alle gespeicherten Eversports-Passwörter im Klartext lesen. Es gibt keine Möglichkeit, dieses Risiko vollständig zu eliminieren, ohne die Architektur grundlegend zu ändern (z. B. OAuth-Delegation durch Eversports, falls verfügbar).

**Minderung:** Sicherstellen, dass Datenbankzugriff und Umgebungsvariablen/Secrets separat gehärtet sind — ein einzelner Angriffspunkt reicht nicht aus.
