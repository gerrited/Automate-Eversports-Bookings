# Notice Banner — Design Spec

**Datum:** 2026-04-26

## Überblick

Schlanke Benachrichtigungsleiste, die im Header der App angezeigt wird. Zwei unabhängige Nachrichten möglich: eine öffentliche (für alle) und eine für eingeloggte User. Inhalte werden aus konfigurierbaren GitHub Gists geladen.

---

## Konfiguration

Zwei optionale Vite-Umgebungsvariablen:

| Variable | Sichtbarkeit |
|---|---|
| `VITE_NOTICE_PUBLIC_GIST_URL` | Alle Besucher (Landing + Dashboard) |
| `VITE_NOTICE_USERS_GIST_URL` | Nur eingeloggte User (Dashboard) |

- Ist eine Variable nicht gesetzt oder der Gist-Inhalt leer/nur Whitespace → kein Banner.
- Beide Banner können gleichzeitig aktiv sein (öffentlich + User); sie stapeln sich untereinander.

---

## Datenabruf & Caching

**Hook:** `useNotice(url: string | undefined): string | null`

- Prüft zunächst einen modulscope-Cache (`Map<string, string>`).
- Bei Cache-Miss: `fetch` der raw Gist-URL.
- Ergebnis wird gecacht (für die Lebensdauer der Browser-Session — kein `localStorage`).
- Fehler beim Laden → `null` zurückgeben, Banner wird still weggelassen.
- Gibt `null` zurück wenn `url` undefined ist.

---

## Markdown-Parser

**Funktion:** `parseNotice(text: string): ReactNode[]`

Unterstützte Syntax (reine Einzeiler-Nachrichten):

| Syntax | Ergebnis |
|---|---|
| `**fett**` | `<strong>` |
| `[text](url)` | `<a target="_blank" rel="noopener noreferrer">` |
| Emoji (Unicode) | Unverändert durchgereicht |

Implementierung: Regex-basierter Token-Splitter, keine externe Library. Token werden von links nach rechts verarbeitet; Nesting (z.B. `**[Link](url)**`) wird nicht unterstützt.

---

## `NoticeBanner`-Komponente

**Props:** `{ url: string | undefined }`

- Rendert nichts wenn `url` undefined oder Inhalt leer.
- Styles analog zum Footer: Hintergrund `#021214`, Text `#9ca3af`, Border-Bottom `1px solid #0d3538`.
- `position: fixed; top: 0; left: 0; right: 0; z-index: 30`
- Textgröße `0.7rem`, padding `6px`, zentriert.
- Links erben die Textfarbe mit `text-decoration: underline`.
- **CSS-Variable:** Nach dem Rendern setzt ein `useEffect` via `ResizeObserver` die Variable `--notice-height` auf `document.documentElement`. Beim Unmount → `0px`.

---

## Integration

### `App.tsx`

```
<BrowserRouter>
  <NoticeBanner url={import.meta.env.VITE_NOTICE_PUBLIC_GIST_URL} />
  <Routes>...</Routes>
  <Footer />
</BrowserRouter>
```

### `LandingPage.tsx`

Das `<nav>`-Element wechselt von `top-0` auf dynamisches Top via inline `style`:

```tsx
<nav style={{ top: 'var(--notice-height, 0px)' }} className="fixed left-0 right-0 z-20 ...">
```

### `DashboardPage.tsx`

Der fixierte Header-`<div>` bekommt dieselbe Anpassung. Zusätzlich wird der User-Banner gerendert — er wird direkt unterhalb des öffentlichen Banners positioniert, indem er ebenfalls `position: fixed` mit `top: var(--notice-height, 0px)` erhält und seinerseits `--notice-users-height` setzt. Die existierenden Header-Inhalte (Logo + Tabs) referenzieren dann `calc(var(--notice-height, 0px) + var(--notice-users-height, 0px))`.

> Vereinfachung: Da Auth-Nachrichten nur auf dem Dashboard sichtbar sind und öffentliche Nachrichten auf beiden Seiten, ist der häufigste Fall, dass nur ein Banner aktiv ist. Das Stapeln zweier Banner ist möglich aber selten.

### `pt-`-Offset des Dashboard-Inhalts

Der Content-Bereich im Dashboard (`pt-32 sm:pt-44`) muss ebenfalls die Banner-Höhe berücksichtigen. Die Tailwind-Klassen werden durch ein `style`-Prop ergänzt:

```tsx
<div style={{ paddingTop: 'calc(var(--notice-height, 0px) + var(--notice-users-height, 0px) + 8rem)' }}>
```

(Die `pt-32`/`pt-44`-Klassen werden entfernt und vollständig via `style` gesetzt.)

---

## Dateistruktur (neu)

```
frontend/src/
  hooks/
    useNotice.ts          # Fetch + Session-Cache
  utils/
    parseNotice.tsx       # Markdown Mini-Parser → ReactNode[]
  components/
    NoticeBanner.tsx      # Banner-Komponente + ResizeObserver
```

---

## Nicht im Scope

- Dismiss/Schließen-Button
- Server-seitiges Caching / CDN
- Mehr als eine Nachricht pro Typ gleichzeitig
- Mehrzeilige Nachrichten (kein explizites Verbot, aber nicht gestaltet)
