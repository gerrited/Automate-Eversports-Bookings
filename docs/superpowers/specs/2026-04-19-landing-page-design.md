# Landing Page — Design-Spec

**Datum:** 2026-04-19

## Ziel

Eine Landing Page anzeigen, wenn der Benutzer nicht eingeloggt ist. Sie erklärt die App mit zwei Screenshots und einem Video und ermöglicht die Anmeldung über ein Modal.

---

## Routing & Auth-Guard

Die aktuelle `App.tsx` leitet unangemeldete Benutzer direkt zu `/login` weiter. Das wird geändert:

- `/` → `LandingPage` (immer öffentlich)
- `/dashboard` → `DashboardPage` (nur mit Token; sonst Redirect zu `/`)
- `/login` entfällt als eigene Route — das Login-Formular wird nur noch als Modal auf der Landing Page geöffnet
- `RequireAuth` leitet bei fehlendem Token zu `/` statt zu `/login`

---

## Komponenten

### `LandingPage` (neue Seite: `src/pages/LandingPage.tsx`)

Enthält die gesamte Landing Page. Verwaltet den `loginModalOpen`-State.

**Struktur (Layout C):**

```
<Navbar>          Logo links | "Anmelden"-Button rechts
<Hero>            Claim + Beschreibung + CTA links | Screenshot 1 rechts
<VideoSection>    Label + Titel + Beschreibung + Video (volle Breite)
<Screenshot2>     Beschreibungstext links | Screenshot 2 rechts
<FooterCTA>       Nochmaliger "Anmelden"-Button
<LoginModal>      Conditional — öffnet sich bei Klick auf jeden Anmelden-Button
```

### `LoginModal` (neue Komponente: `src/components/LoginModal.tsx`)

Wrapper um das bestehende Login-Formular aus `LoginPage.tsx`. Zeigt sich als Modal über der Landing Page.

- Prop: `onClose: () => void`
- Enthält die komplette Login-Logik (Email, Passwort, Fehlerbehandlung, Navigation zu `/dashboard` bei Erfolg)
- Schließt sich bei Klick auf den Backdrop oder das X-Icon
- Schließt sich bei erfolgreichem Login (nach `navigate('/dashboard')`)

Das Login-Formular wird aus `LoginPage.tsx` in `LoginModal.tsx` extrahiert. `LoginPage.tsx` kann danach entfernt werden.

---

## Inhalte

### Navbar
- Links: `logo.png` (identisch zur Dashboard-Navbar)
- Rechts: Button "Anmelden" → öffnet `LoginModal`

### Hero
- **Headline:** „Nie wieder Buchung verpassen."
- **Subtext:** „Richte deine Eversports-Buchungen einmal ein – die App bucht automatisch jede Woche zur richtigen Zeit."
- **CTA-Button:** „Jetzt anmelden →" → öffnet `LoginModal`
- **Rechts:** Screenshot 1 (Platzhalter bis echtes Asset vorhanden)

### Video-Sektion
- **Label:** „So funktioniert's"
- **Titel:** „Einmal einrichten, jede Woche profitieren"
- **Beschreibung:** „Wähle Kurs, Uhrzeit und Wochentag – die App erledigt den Rest vollautomatisch."
- **Video:** Platzhalter-Block (volle Breite), später echte Video-Datei aus `/public`

### Screenshot 2
- **Label:** „Übersicht behalten"
- **Titel:** „Alle Buchungen auf einen Blick"
- **Beschreibung:** „Sieh alle geplanten Buchungen, aktiviere oder pausiere sie jederzeit – direkt in der App."
- **Rechts:** Screenshot 2 (Platzhalter)

### Footer-CTA
- Kurzer Claim + nochmaliger „Anmelden"-Button

---

## Styling

- Farbschema identisch mit bestehendem Design: `bg-surface-page` (#021214), `bg-brand` (#004349), Tailwind-Klassen
- Kein neues CSS — ausschließlich bestehende CSS-Variablen und Tailwind-Utility-Klassen
- Modal: dunkler Backdrop (`bg-black/60`), Formular-Card zentriert, schließbar per Escape-Taste und Backdrop-Klick

---

## Datei-Änderungen

| Aktion | Datei |
|--------|-------|
| Neu | `src/pages/LandingPage.tsx` |
| Neu | `src/components/LoginModal.tsx` |
| Ändern | `src/App.tsx` — Routing anpassen |
| Entfernen | `src/pages/LoginPage.tsx` (nach Extraktion) |
| Entfernen | `src/pages/LoginPage.test.tsx` (oder anpassen) |

---

## Medien-Platzhalter

Screenshots und Video werden zunächst als gestylte Platzhalter-Divs implementiert. Wenn echte Assets bereitstehen, werden sie als `<img src="/screenshot-1.png">` bzw. `<video>` eingebunden — keine Logik-Änderung nötig.
