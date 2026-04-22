# ADR-005: Frontend-UI-Design — Karten, Modal, Log-Drawer

**Datum:** 2026-04-11  
**Status:** Akzeptiert

## Kontext

Das Dashboard muss die Buchungen eines Benutzers anzeigen und Bedienelemente zum Hinzufügen, Bearbeiten, Aktivieren/Deaktivieren, Löschen und Einsehen des Ausführungsverlaufs jeder Buchung bieten. Zwei Layoutoptionen wurden geprüft:

**Option A — Karte pro Buchung:** Eine Karte pro Buchung, Toggle inline sichtbar, Bearbeiten/Löschen-Buttons am unteren Rand jeder Karte.  
**Option B — Tabelle:** Alle Buchungen in einer Tabelle, kompakter, aber auf einen Blick schwerer erfassbar.

## Entscheidung

**Option A (Karten) wurde gewählt.** Jede `JobCard` zeigt Wochentag, Uhrzeit, Kursname, Anbieter, Toggle sowie Bearbeiten/Löschen-Aktionen. Ein Klick auf den Kartenkörper öffnet den `LogDrawer`.

### Komponentenübersicht

- **`LoginPage`** — E-Mail + Passwort-Formular. Delegiert Authentifizierung ans Eversports-Backend. Leitet bei Erfolg zu `/dashboard` weiter, zeigt bei Fehler eine `role="alert"`-Meldung.
- **`JobCard`** — Zeigt eine Buchung an. Der Toggle (`role="switch"`) ruft `onToggle` auf, ohne zu navigieren. Bearbeiten- und Löschen-Buttons rufen ihre jeweiligen Handler auf. Der Kartenkörper (`data-testid="job-card-body"`) ruft `onSelect` auf, um den Log-Drawer zu öffnen.
- **`JobModal`** — Modal-Dialog zum Erstellen und Bearbeiten von Buchungen. Füllt alle Felder vor, wenn eine bestehende Buchung übergeben wird. Felder: Wochentag (Dropdown), Uhrzeit, Kursname, Anbieter-ID, Tage im Voraus.
- **`LogDrawer`** — Einfahrendes Panel von rechts, das die letzten 20 Ausführungen einer Buchung zeigt. Status ist farbcodiert: grün für `success`, rot für `failed`, grau für `already_booked`. Schließt über Backdrop-Klick oder ✕-Button.
- **`DashboardPage`** — Orchestriert alles obige. Verwaltet State für Modal-Sichtbarkeit, ausgewählte Buchung und Log-Daten. Ruft den API-Client bei jeder Mutation auf und aktualisiert die Buchungsliste.
- **`App`** — BrowserRouter mit einem `RequireAuth`-Guard, der unauthentifizierte Benutzer zu `/login` weiterleitet.

### API-Kommunikation

Keine externe State-Bibliothek. Alle API-Calls verwenden einen schlanken `apiFetch`-Wrapper (`src/api/client.ts`), der das JWT aus `localStorage` injiziert und bei einer `401`-Antwort zu `/login` weiterleitet.

In der Produktion proxied nginx `/api/` zum Backend-Kubernetes-Service — keine CORS-Konfiguration erforderlich. In der lokalen Entwicklung proxied Vite `/api/` zu `localhost:8000`.

## Konsequenzen

- Das Kartenlayout ist bei vielen Buchungen etwas gesprächiger als eine Tabelle, wurde aber wegen besserer Lesbarkeit und Mobile-Freundlichkeit bevorzugt.
- JWT-Speicherung in `localStorage` ist für dieses interne Tool akzeptabel. Eine sicherheitssensitivere Anwendung sollte `httpOnly`-Cookies bevorzugen.
- Es gibt keine optimistische UI-Aktualisierung — jede Mutation wartet auf die API-Antwort und lädt danach die vollständige Buchungsliste neu. Das hält den Client-State einfach auf Kosten eines zusätzlichen Round-Trips pro Aktion.
