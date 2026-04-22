# FAQ Modal — Design Spec

**Date:** 2026-04-20

## Overview

Add a FAQ section accessible from every page via a link in the global footer. The FAQ opens as a modal overlay with collapsible accordion items.

## Architecture

- **`FaqModal.tsx`** — new standalone component, self-contained with all FAQ content
- **`Footer.tsx`** — add "FAQ" link + `useState` to open/close the modal; render `<FaqModal>` inside Footer when open

No routing changes needed. No new pages. Footer is already rendered globally in `App.tsx` so the link appears on both LandingPage and DashboardPage automatically.

## Components

### FaqModal

- Full-screen backdrop (`fixed inset-0 bg-black/60 z-50`), click to close
- Centered card (`surface-card`, `border-slate-700/60`, `rounded-xl`, scrollable)
- Close button (×) top-right
- Title: "Häufig gestellte Fragen"
- 5 accordion items using native `<details>/<summary>` — no custom state needed
- Styled to match app dark theme (`text-white`, `text-slate-400`)

### Footer (updated)

- Add "FAQ" text link on the left side of the existing footer bar
- Separated from version/commit info by a `·` divider
- `onClick` sets local `faqOpen` state to `true`
- Renders `<FaqModal onClose={() => setFaqOpen(false)} />` when open

## FAQ Content

| # | Frage | Antwort |
|---|-------|---------|
| 1 | Wie viele Buchungen kann ich planen? | Du kannst beliebig viele Buchungen anlegen. Jede Buchung steht für einen wiederkehrenden Termin – z.B. jeden Montag um 18 Uhr Yoga bei Anbieter X. Es gibt keine Obergrenze. |
| 2 | Werden alle Anbieter, Kurse und Klassen bei Eversports unterstützt? | Die App funktioniert mit allen Anbietern und Kursen, die über Eversports buchbar sind. Voraussetzung ist, dass du bei dem jeweiligen Anbieter bereits ein Konto hast und eine gültige Mitgliedschaft oder ausreichend Credits besitzt – die App bucht in deinem Namen, kann aber keine fehlenden Berechtigungen umgehen. |
| 3 | Was sind einmalige Buchungen? | Bei einer einmaligen Buchung wird der Job nach der ersten erfolgreichen Buchung automatisch gelöscht. Das ist nützlich, wenn du nur einen einzelnen Termin automatisieren möchtest, ohne einen dauerhaften wiederkehrenden Job anzulegen. |
| 4 | Wie werden meine Zugangsdaten gespeichert? | Dein Eversports-Passwort wird verschlüsselt in der Datenbank gespeichert und nie im Klartext abgelegt. Die App verwendet deine Daten ausschließlich, um Buchungen in deinem Namen durchzuführen – sie werden nicht weitergegeben. |
| 5 | Welche E-Mails erhalte ich? | Du erhältst eine E-Mail, wenn eine Buchung fehlschlägt – z.B. weil der Kurs bereits ausgebucht ist, deine Mitgliedschaft abgelaufen ist oder es ein technisches Problem gab. Bei erfolgreichen Buchungen bekommst du eine Bestätigungs-E-Mail direkt von Eversports. |

## Styling Conventions

Follows existing app patterns:
- Dark theme: `bg-surface-page` (#021214), `bg-surface-card` (#03191b)
- Accent: `text-brand-hover` (#005a62)
- Borders: `border-slate-700/60`
- Text: `text-white` (headings), `text-slate-400` (body)
- Tailwind CSS v4

## What's Not in Scope

- No search/filter within FAQ
- No links to external documentation
- No admin interface to edit FAQ content
