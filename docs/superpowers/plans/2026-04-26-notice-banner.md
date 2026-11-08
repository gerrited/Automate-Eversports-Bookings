# Notice Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Schlanken Benachrichtigungs-Banner ganz oben in der App implementieren, der Inhalte aus konfigurierbaren GitHub Gists lädt — öffentlich (Landing + Dashboard) und für eingeloggte User (nur Dashboard).

**Architecture:** `NoticeBanner` ist eine `position: fixed` Komponente, die nach dem Rendern die CSS-Variable `--notice-height` (bzw. `--notice-users-height`) auf `document.documentElement` setzt. Die bestehenden Fixed-Header beider Pages lesen diese Variable für ihr `top`-Offset. Inhalte werden einmalig per `fetch` geladen und im Modulscope gecacht. Markdown (Fett, Links) wird durch einen eigenen Mini-Parser in ReactNodes umgewandelt.

**Tech Stack:** React 19, TypeScript, Vitest, @testing-library/react, jsdom, kein neues npm-Paket.

---

## Dateistruktur

| Datei | Aktion | Inhalt |
|---|---|---|
| `frontend/src/utils/parseNotice.tsx` | Neu | Markdown Mini-Parser → `ReactNode[]` |
| `frontend/src/utils/parseNotice.test.tsx` | Neu | Tests für den Parser |
| `frontend/src/hooks/useNotice.ts` | Neu | Fetch + Modulscope-Cache |
| `frontend/src/hooks/useNotice.test.ts` | Neu | Tests für den Hook |
| `frontend/src/components/NoticeBanner.tsx` | Neu | Banner-Komponente + ResizeObserver |
| `frontend/src/components/NoticeBanner.test.tsx` | Neu | Tests für die Komponente |
| `frontend/src/App.tsx` | Ändern | Öffentlichen Banner einbinden |
| `frontend/src/pages/LandingPage.tsx` | Ändern | `<nav>` top-Offset anpassen + Spacer |
| `frontend/src/pages/DashboardPage.tsx` | Ändern | User-Banner einbinden, Header-Offset + Content-Spacer |

---

## Task 1: `parseNotice` — Markdown Mini-Parser

**Files:**
- Create: `frontend/src/utils/parseNotice.tsx`
- Create: `frontend/src/utils/parseNotice.test.tsx`

- [ ] **Step 1: Test-Datei anlegen**

```tsx
// frontend/src/utils/parseNotice.test.tsx
import { render } from '@testing-library/react'
import { parseNotice } from './parseNotice'

function renderNotice(text: string) {
  const { container } = render(<span>{parseNotice(text)}</span>)
  return container
}

describe('parseNotice', () => {
  it('gibt einfachen Text unverändert zurück', () => {
    expect(renderNotice('Hello world').textContent).toBe('Hello world')
  })

  it('wandelt **fett** in strong um', () => {
    const container = renderNotice('Hello **world**')
    expect(container.querySelector('strong')?.textContent).toBe('world')
  })

  it('wandelt [text](url) in a mit target _blank um', () => {
    const container = renderNotice('[klick](https://example.com)')
    const a = container.querySelector('a')
    expect(a?.textContent).toBe('klick')
    expect(a?.getAttribute('href')).toBe('https://example.com')
    expect(a?.getAttribute('target')).toBe('_blank')
    expect(a?.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('verarbeitet gemischten Inhalt mit Emoji', () => {
    const container = renderNotice('🎉 **Neu**: [Details](https://example.com)')
    expect(container.textContent).toBe('🎉 Neu: Details')
    expect(container.querySelector('strong')?.textContent).toBe('Neu')
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.com')
  })

  it('verarbeitet mehrere Links', () => {
    const container = renderNotice('[A](https://a.com) und [B](https://b.com)')
    const links = container.querySelectorAll('a')
    expect(links).toHaveLength(2)
    expect(links[0].textContent).toBe('A')
    expect(links[1].textContent).toBe('B')
  })
})
```

- [ ] **Step 2: Test ausführen — Fehlschlag erwarten**

Befehl: `cd frontend && npm test -- parseNotice`

Erwartetes Ergebnis: FAIL mit "Cannot find module './parseNotice'"

- [ ] **Step 3: Implementierung schreiben**

```tsx
// frontend/src/utils/parseNotice.tsx
import type { ReactNode } from 'react'

export function parseNotice(text: string): ReactNode[] {
  const pattern = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g
  const parts: ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index))
    }
    const token = match[0]
    if (token.startsWith('**')) {
      parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>)
    } else {
      const m = token.match(/\[([^\]]+)\]\(([^)]+)\)/)
      if (m) {
        parts.push(
          <a
            key={key++}
            href={m[2]}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'inherit', textDecoration: 'underline' }}
          >
            {m[1]}
          </a>
        )
      }
    }
    lastIndex = match.index + token.length
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex))
  }

  return parts
}
```

- [ ] **Step 4: Tests ausführen — alle sollen bestehen**

Befehl: `cd frontend && npm test -- parseNotice`

Erwartetes Ergebnis: 5 Tests PASS

- [ ] **Step 5: Commit**

```
git add frontend/src/utils/parseNotice.tsx frontend/src/utils/parseNotice.test.tsx
git commit -m "feat: add parseNotice markdown mini-parser"
```

---

## Task 2: `useNotice` — Fetch-Hook mit Session-Cache

**Files:**
- Create: `frontend/src/hooks/useNotice.ts`
- Create: `frontend/src/hooks/useNotice.test.ts`

- [ ] **Step 1: Test-Datei anlegen**

```ts
// frontend/src/hooks/useNotice.test.ts
import { renderHook, waitFor } from '@testing-library/react'
import { vi, afterEach } from 'vitest'
import { useNotice, clearNoticeCache } from './useNotice'

afterEach(() => {
  clearNoticeCache()
  vi.restoreAllMocks()
})

describe('useNotice', () => {
  it('gibt null zurück wenn url undefined ist', () => {
    const { result } = renderHook(() => useNotice(undefined))
    expect(result.current).toBeNull()
  })

  it('lädt Inhalt und gibt ihn zurück', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      text: () => Promise.resolve('Hello **world**'),
    }))
    const { result } = renderHook(() => useNotice('https://gist.example.com/notice.md'))
    await waitFor(() => expect(result.current).toBe('Hello **world**'))
  })

  it('gibt null zurück wenn Inhalt nur Whitespace ist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      text: () => Promise.resolve('   \n  '),
    }))
    const { result } = renderHook(() => useNotice('https://gist.example.com/notice.md'))
    await waitFor(() => expect(result.current).toBeNull())
  })

  it('gibt null zurück bei Fetch-Fehler', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const { result } = renderHook(() => useNotice('https://gist.example.com/notice.md'))
    await waitFor(() => expect(result.current).toBeNull())
  })

  it('cached Ergebnisse und ruft fetch nur einmal auf', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      text: () => Promise.resolve('cached content'),
    })
    vi.stubGlobal('fetch', mockFetch)
    const { result } = renderHook(() => useNotice('https://gist.example.com/notice.md'))
    await waitFor(() => expect(result.current).toBe('cached content'))
    renderHook(() => useNotice('https://gist.example.com/notice.md'))
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Test ausführen — Fehlschlag erwarten**

Befehl: `cd frontend && npm test -- useNotice`

Erwartetes Ergebnis: FAIL mit "Cannot find module './useNotice'"

- [ ] **Step 3: Implementierung schreiben**

```ts
// frontend/src/hooks/useNotice.ts
import { useState, useEffect } from 'react'

const cache = new Map<string, string>()

export function clearNoticeCache(): void {
  cache.clear()
}

export function useNotice(url: string | undefined): string | null {
  const [content, setContent] = useState<string | null>(() => {
    if (!url) return null
    const cached = cache.get(url)
    return cached !== undefined ? (cached || null) : null
  })

  useEffect(() => {
    if (!url) return
    if (cache.has(url)) {
      setContent(cache.get(url) || null)
      return
    }
    fetch(url)
      .then(r => r.text())
      .then(text => {
        const trimmed = text.trim()
        cache.set(url, trimmed)
        setContent(trimmed || null)
      })
      .catch(() => {
        setContent(null)
      })
  }, [url])

  return content
}
```

- [ ] **Step 4: Tests ausführen — alle sollen bestehen**

Befehl: `cd frontend && npm test -- useNotice`

Erwartetes Ergebnis: 5 Tests PASS

- [ ] **Step 5: Commit**

```
git add frontend/src/hooks/useNotice.ts frontend/src/hooks/useNotice.test.ts
git commit -m "feat: add useNotice hook with session cache"
```

---

## Task 3: `NoticeBanner` — Komponente

**Files:**
- Create: `frontend/src/components/NoticeBanner.tsx`
- Create: `frontend/src/components/NoticeBanner.test.tsx`

- [ ] **Step 1: Test-Datei anlegen**

```tsx
// frontend/src/components/NoticeBanner.test.tsx
import { render, screen } from '@testing-library/react'
import { vi, beforeEach } from 'vitest'
import NoticeBanner from './NoticeBanner'
import * as useNoticeModule from '../hooks/useNotice'

beforeEach(() => {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))
})

describe('NoticeBanner', () => {
  it('rendert nichts wenn url undefined ist', () => {
    vi.spyOn(useNoticeModule, 'useNotice').mockReturnValue(null)
    const { container } = render(<NoticeBanner url={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('rendert nichts wenn Inhalt null ist', () => {
    vi.spyOn(useNoticeModule, 'useNotice').mockReturnValue(null)
    const { container } = render(<NoticeBanner url="https://example.com/notice.md" />)
    expect(container.firstChild).toBeNull()
  })

  it('rendert den Nachrichtentext', () => {
    vi.spyOn(useNoticeModule, 'useNotice').mockReturnValue('Wichtiger Hinweis')
    render(<NoticeBanner url="https://example.com/notice.md" />)
    expect(screen.getByText('Wichtiger Hinweis')).toBeInTheDocument()
  })

  it('rendert fetten Text als strong', () => {
    vi.spyOn(useNoticeModule, 'useNotice').mockReturnValue('**Wichtig**: Update verfügbar')
    render(<NoticeBanner url="https://example.com/notice.md" />)
    expect(screen.getByText('Wichtig').tagName).toBe('STRONG')
  })

  it('rendert Link mit korrekten Attributen', () => {
    vi.spyOn(useNoticeModule, 'useNotice').mockReturnValue('[Mehr erfahren](https://example.com)')
    render(<NoticeBanner url="https://example.com/notice.md" />)
    const link = screen.getByRole('link', { name: 'Mehr erfahren' })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('setzt CSS-Variable --notice-height beim Mounten', () => {
    vi.spyOn(useNoticeModule, 'useNotice').mockReturnValue('Hinweis')
    const setSpy = vi.spyOn(document.documentElement.style, 'setProperty')
    render(<NoticeBanner url="https://example.com/notice.md" />)
    expect(setSpy).toHaveBeenCalledWith('--notice-height', expect.any(String))
  })

  it('setzt benutzerdefinierte CSS-Variable wenn cssVar angegeben', () => {
    vi.spyOn(useNoticeModule, 'useNotice').mockReturnValue('Hinweis')
    const setSpy = vi.spyOn(document.documentElement.style, 'setProperty')
    render(<NoticeBanner url="https://example.com/notice.md" cssVar="--notice-users-height" />)
    expect(setSpy).toHaveBeenCalledWith('--notice-users-height', expect.any(String))
  })
})
```

- [ ] **Step 2: Test ausführen — Fehlschlag erwarten**

Befehl: `cd frontend && npm test -- NoticeBanner`

Erwartetes Ergebnis: FAIL mit "Cannot find module './NoticeBanner'"

- [ ] **Step 3: Komponente implementieren**

```tsx
// frontend/src/components/NoticeBanner.tsx
import { useRef, useEffect } from 'react'
import { useNotice } from '../hooks/useNotice'
import { parseNotice } from '../utils/parseNotice'

interface Props {
  url: string | undefined
  topOffset?: string
  cssVar?: string
}

export default function NoticeBanner({ url, topOffset = '0px', cssVar = '--notice-height' }: Props) {
  const content = useNotice(url)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    document.documentElement.style.setProperty(cssVar, `${el.offsetHeight}px`)
    const observer = new ResizeObserver(() => {
      document.documentElement.style.setProperty(cssVar, `${el.offsetHeight}px`)
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      document.documentElement.style.setProperty(cssVar, '0px')
    }
  }, [cssVar])

  if (!content) return null

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: topOffset,
        left: 0,
        right: 0,
        zIndex: 30,
        background: '#021214',
        borderBottom: '1px solid #0d3538',
        padding: '6px',
        textAlign: 'center',
        fontSize: '0.7rem',
        color: '#9ca3af',
      }}
    >
      {parseNotice(content)}
    </div>
  )
}
```

- [ ] **Step 4: Tests ausführen — alle sollen bestehen**

Befehl: `cd frontend && npm test -- NoticeBanner`

Erwartetes Ergebnis: 7 Tests PASS

- [ ] **Step 5: Commit**

```
git add frontend/src/components/NoticeBanner.tsx frontend/src/components/NoticeBanner.test.tsx
git commit -m "feat: add NoticeBanner component with ResizeObserver"
```

---

## Task 4: Integration in `App.tsx` und `LandingPage.tsx`

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/LandingPage.tsx`

- [ ] **Step 1: `App.tsx` — öffentlichen Banner einbinden**

Datei `frontend/src/App.tsx` so abändern:

```tsx
import type { ReactElement } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/DashboardPage'
import Footer from './components/Footer'
import NoticeBanner from './components/NoticeBanner'

function RequireAuth({ children }: { children: ReactElement }) {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <NoticeBanner url={import.meta.env.VITE_NOTICE_PUBLIC_GIST_URL as string | undefined} />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route
          path="/dashboard"
          element={<RequireAuth><DashboardPage /></RequireAuth>}
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
      <Footer />
    </BrowserRouter>
  )
}
```

- [ ] **Step 2: `LandingPage.tsx` — Nav-Offset und Spacer**

**Änderung 1** — `<nav>` bekommt `style` statt `top-0` (ca. Zeile 45):

Alt:
```tsx
<nav className="fixed top-0 left-0 right-0 z-20 bg-surface-page border-b border-slate-700/60">
```

Neu:
```tsx
<nav className="fixed left-0 right-0 z-20 bg-surface-page border-b border-slate-700/60" style={{ top: 'var(--notice-height, 0px)' }}>
```

**Änderung 2** — Spacer nach `<div className="pt-20 sm:pt-24">` einfügen (ca. Zeile 57):

Alt:
```tsx
<div className="pt-20 sm:pt-24">

  {/* Hero */}
```

Neu:
```tsx
<div className="pt-20 sm:pt-24">
  <div aria-hidden style={{ height: 'var(--notice-height, 0px)' }} />

  {/* Hero */}
```

- [ ] **Step 3: Alle Tests ausführen**

Befehl: `cd frontend && npm test`

Erwartetes Ergebnis: alle Tests PASS

- [ ] **Step 4: Commit**

```
git add frontend/src/App.tsx frontend/src/pages/LandingPage.tsx
git commit -m "feat: integrate public NoticeBanner in App and LandingPage"
```

---

## Task 5: Integration in `DashboardPage.tsx`

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Import hinzufügen**

Am Anfang der Imports in `frontend/src/pages/DashboardPage.tsx` einfügen:

```tsx
import NoticeBanner from '../components/NoticeBanner'
```

- [ ] **Step 2: User-Banner und Header-Offset einbauen**

Den aktuellen Fixed-Header-Block (ca. Zeile 216):

```tsx
{/* Fixed Header */}
<div className="fixed top-0 left-0 right-0 z-20 bg-surface-page border-b border-slate-700/60">
```

ersetzen durch:

```tsx
{/* Fixed Header */}
<NoticeBanner
  url={import.meta.env.VITE_NOTICE_USERS_GIST_URL as string | undefined}
  topOffset="var(--notice-height, 0px)"
  cssVar="--notice-users-height"
/>
<div
  className="fixed left-0 right-0 z-20 bg-surface-page border-b border-slate-700/60"
  style={{ top: 'calc(var(--notice-height, 0px) + var(--notice-users-height, 0px))' }}
>
```

- [ ] **Step 3: Content-Spacer hinzufügen**

Den Content-Wrapper (ca. Zeile 255):

```tsx
<div className="px-4 pb-8 max-w-2xl mx-auto pt-32 sm:pt-44">
```

bleibt unverändert. Direkt danach als erstes Kind einfügen:

```tsx
<div aria-hidden style={{ height: 'calc(var(--notice-height, 0px) + var(--notice-users-height, 0px))' }} />
```

- [ ] **Step 4: Alle Tests ausführen**

Befehl: `cd frontend && npm test`

Erwartetes Ergebnis: alle Tests PASS

- [ ] **Step 5: Commit**

```
git add frontend/src/pages/DashboardPage.tsx
git commit -m "feat: integrate user NoticeBanner in DashboardPage"
```

---

## Manuelle Verifikation

- [ ] Dev-Server starten (Backend + Frontend laut CLAUDE.md)
- [ ] `VITE_NOTICE_PUBLIC_GIST_URL` auf eine raw Gist-URL setzen, die z.B. enthält: `🔧 **Wartung** am 30. April — [Details](https://example.com)`
- [ ] Öffentlicher Banner erscheint auf der Landing Page über dem Nav
- [ ] Öffentlicher Banner erscheint auf dem Dashboard über dem Header
- [ ] Ohne env var erscheint kein Banner und kein leerer Platzhalter
- [ ] `VITE_NOTICE_USERS_GIST_URL` setzen und einloggen — zweiter Banner nur auf Dashboard sichtbar
- [ ] Beide Banner gleichzeitig aktiv: korrekt gestapelt, kein Überlappen
- [ ] Seiteninhalt wird nirgendwo vom Banner verdeckt
