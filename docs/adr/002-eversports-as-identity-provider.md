# ADR-002: Eversports als einziger Identity Provider

**Datum:** 2026-04-11  
**Status:** Akzeptiert

## Kontext

Die Plattform benötigt Benutzerauthentifizierung. Benutzer haben bereits Eversports-Konten, und das Buchungssystem erfordert zwingend gültige Eversports-Zugangsdaten. Es wurden drei Optionen geprüft:

1. Ein eigenes Benutzername/Passwort-System aufbauen und Eversports-Zugangsdaten unabhängig speichern.
2. Eversports als Identity Provider verwenden — Zugangsdaten bei Login an Eversports weiterleiten, bei Erfolg eigenes JWT ausstellen.
3. OAuth / SSO mit einem Drittanbieter (Google etc.) — nicht praktikabel, da Eversports-Zugangsdaten in jedem Fall benötigt werden.

## Entscheidung

**Eversports ist der einzige Authentifizierungsanker.** Es gibt kein eigenes Passwort-System.

Login-Flow:
1. Benutzer sendet E-Mail + Passwort via `POST /api/auth/login`.
2. Backend leitet Zugangsdaten an die Eversports-GraphQL-Mutation `LoginCredentialLogin` weiter.
3. Bei Fehler: `401` ans Frontend zurückgeben.
4. Bei Erfolg: `user.id` aus der Eversports-Response entnehmen, Benutzer in der Datenbank anlegen oder aktualisieren, AES-256-GCM-verschlüsseltes Passwort speichern und ein 24-stündiges HS256-JWT ausstellen.
5. Das Frontend speichert das JWT im `localStorage` und sendet es als `Authorization: Bearer <token>` bei jedem Folge-Request.

Das verschlüsselte Passwort wird gespeichert, damit der **Worker** später Buchungen durchführen kann, ohne dass der Benutzer zum Buchungszeitpunkt eingeloggt sein muss.

Bei jedem Login wird das verschlüsselte Passwort in der Datenbank aktualisiert. Passwortänderungen auf Eversports-Seite werden damit beim nächsten Login automatisch übernommen.

## Konsequenzen

- Kein eigener Passwort-Reset-Flow nötig — Benutzer verwalten ihr Passwort vollständig bei Eversports.
- Ändert ein Benutzer sein Eversports-Passwort und loggt sich nicht erneut ein, schlägt der Worker bei der nächsten Buchung fehl.
- Das Kubernetes-Secret `ENCRYPTION_KEY` muss sowohl im Backend als auch im Worker vorhanden sein — es ist der Single Point of Failure für die Zugangsdatenspeicherung. Eine Rotation erfordert die Neuverschlüsselung aller gespeicherten Passwörter.
- Das JWT läuft nach 24 Stunden ab. Es gibt keinen Refresh-Token-Mechanismus; Benutzer authentifizieren sich erneut durch erneuten Login.
