# ADR-003: Datenmodell — Drei Tabellen, String-PKs

**Datum:** 2026-04-11  
**Status:** Akzeptiert

## Kontext

Benutzer, ihre Buchungsplanungen und ein Ausführungsprotokoll jedes Buchungsversuchs müssen persistiert werden. Das Schema muss sowohl mit PostgreSQL (Produktion) als auch mit SQLite (Tests) funktionieren.

## Entscheidung

Drei Tabellen, verwaltet mit SQLAlchemy + Alembic:

### `users`
| Spalte | Typ | Hinweise |
|---|---|---|
| `id` | TEXT (UUID-String) | PK, generiert in Python |
| `eversports_user_id` | TEXT | Unique — aus Eversports-Login-Response |
| `email` | TEXT | Unique |
| `encrypted_password` | TEXT | AES-256-GCM (AESGCM), Key aus `ENCRYPTION_KEY`-Env-Var (32 Bytes als Hex-String) |
| `created_at` | TIMESTAMPTZ | Gesetzt beim Einfügen |

### `booking_jobs`
| Spalte | Typ | Hinweise |
|---|---|---|
| `id` | TEXT (UUID-String) | PK |
| `user_id` | TEXT | FK → users |
| `weekday` | INTEGER | 0 = Montag … 6 = Sonntag |
| `target_time` | TIME | Kursstart, z.B. `18:00` |
| `facility_id` | TEXT | Eversports-Anbieter-ID, z.B. `"73041"` |
| `class_name` | TEXT | Kursname wie in Eversports angezeigt, z.B. `"CrossFit"` |
| `days_in_advance` | INTEGER | Wie viele Tage vor dem Kurs gebucht wird, z.B. `4` |
| `enabled` | BOOLEAN | Default `true`; deaktivierte Buchungen werden vom Worker übersprungen |
| `created_at` | TIMESTAMPTZ | Gesetzt beim Einfügen |

### `booking_logs`
| Spalte | Typ | Hinweise |
|---|---|---|
| `id` | TEXT (UUID-String) | PK |
| `job_id` | TEXT | FK → booking_jobs |
| `executed_at` | TIMESTAMPTZ | Zeitpunkt der Worker-Ausführung |
| `target_date` | DATE | Datum des gebuchten Kurses |
| `status` | TEXT | `success`, `failed` oder `already_booked` |
| `message` | TEXT nullable | Order-ID bei Erfolg, Fehlermeldung bei Fehler |

## Warum String-PKs statt nativem UUID-Typ

SQLAlchemys `UUID`-Spaltentyp verhält sich über Datenbanken hinweg unterschiedlich. Die Verwendung von `String`-PKs, die in Python mit `str(uuid.uuid4())` befüllt werden, funktioniert identisch auf PostgreSQL und SQLite — unverzichtbar, um Tests schnell und abhängigkeitsfrei zu halten.

## Konsequenzen

- Alembic verwaltet alle Schema-Änderungen. `alembic upgrade head` muss vor jedem Deployment einer neuen Backend-Version ausgeführt werden.
- Die Tabelle `booking_logs` ist append-only — der Worker aktualisiert oder löscht keine Zeilen. Das bewahrt die vollständige Historie und unterstützt die Idempotenz-Prüfung aus ADR-004.
- Es gibt kein Soft-Delete auf `booking_jobs`. Das Löschen einer Buchung kaskadiert auf ihre Logs (`cascade="all, delete-orphan"`).
