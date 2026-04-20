# Security Assessment

Reviewed: 2026-04-20

## Endpoint-Sicherheit

Alle API-Endpunkte sind durch serverseitige Authentifizierung geschützt. Es gibt keine öffentlich erreichbaren Endpunkte außer `POST /api/auth/login`.

| Endpunkt | Schutz |
|---|---|
| `POST /api/auth/login` | öffentlich (Eversports-Credentials werden validiert) |
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

## Bekannte Einschränkung: Passwort-Speicherung

**Kontext:** Das System muss sich periodisch automatisch bei Eversports einloggen. Passwörter müssen daher reversibel gespeichert werden — Hashing ist nicht möglich.

**Implementierung:** Passwörter werden symmetrisch mit Fernet verschlüsselt (`backend/core/encryption.py`). Der Schlüssel kommt aus einer Umgebungsvariable.

**Risiko:** Wer sowohl Datenbankinhalt als auch den Verschlüsselungsschlüssel kompromittiert, kann alle gespeicherten Eversports-Passwörter im Klartext lesen. Es gibt keine Möglichkeit, dieses Risiko vollständig zu eliminieren, ohne die Architektur grundlegend zu ändern (z. B. OAuth-Delegation durch Eversports, falls verfügbar).

**Minderung:** Sicherstellen, dass Datenbankzugriff und Umgebungsvariablen/Secrets separat gehärtet sind — ein einzelner Angriffspunkt reicht nicht aus.
