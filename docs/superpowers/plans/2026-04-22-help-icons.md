# Help Icons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `?` icon next to every label in `JobModal` that opens a popover with a helpful description on click/touch.

**Architecture:** A self-contained `HelpIcon` component manages its own open/closed state and renders the `?` button plus popover. It is dropped inline next to label text in `JobModal`. Click-outside is handled via a `useRef` + `useEffect` document listener inside the component.

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest + @testing-library/react

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `frontend/src/components/HelpIcon.tsx` | `?` button + popover, open/close state |
| Create | `frontend/src/components/HelpIcon.test.tsx` | Unit tests for HelpIcon |
| Modify | `frontend/src/components/JobModal.tsx` | Add `<HelpIcon>` next to each label |

---

### Task 1: HelpIcon component (TDD)

**Files:**
- Create: `frontend/src/components/HelpIcon.test.tsx`
- Create: `frontend/src/components/HelpIcon.tsx`

- [ ] **Step 1: Write the failing tests**

Create `frontend/src/components/HelpIcon.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import HelpIcon from './HelpIcon'

describe('HelpIcon', () => {
  it('renders the ? button', () => {
    render(<HelpIcon text="Hilfetext hier" />)
    expect(screen.getByRole('button', { name: /hilfe/i })).toBeInTheDocument()
  })

  it('popup is hidden by default', () => {
    render(<HelpIcon text="Hilfetext hier" />)
    expect(screen.queryByText('Hilfetext hier')).not.toBeInTheDocument()
  })

  it('shows popup on button click', () => {
    render(<HelpIcon text="Hilfetext hier" />)
    fireEvent.click(screen.getByRole('button', { name: /hilfe/i }))
    expect(screen.getByText('Hilfetext hier')).toBeInTheDocument()
  })

  it('hides popup on second button click', () => {
    render(<HelpIcon text="Hilfetext hier" />)
    fireEvent.click(screen.getByRole('button', { name: /hilfe/i }))
    fireEvent.click(screen.getByRole('button', { name: /hilfe/i }))
    expect(screen.queryByText('Hilfetext hier')).not.toBeInTheDocument()
  })

  it('closes popup when clicking outside', () => {
    render(
      <div>
        <HelpIcon text="Hilfetext hier" />
        <div data-testid="outside">Außen</div>
      </div>
    )
    fireEvent.click(screen.getByRole('button', { name: /hilfe/i }))
    expect(screen.getByText('Hilfetext hier')).toBeInTheDocument()
    fireEvent.mousedown(screen.getByTestId('outside'))
    expect(screen.queryByText('Hilfetext hier')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd frontend && npx vitest run src/components/HelpIcon.test.tsx
```

Expected: FAIL — `HelpIcon` module not found.

- [ ] **Step 3: Implement HelpIcon**

Create `frontend/src/components/HelpIcon.tsx`:

```tsx
import { useState, useRef, useEffect } from 'react'

interface Props {
  text: string
}

export default function HelpIcon({ text }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <span ref={containerRef} className="relative inline-flex items-center">
      <button
        type="button"
        aria-label="Hilfe anzeigen"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-slate-600 text-slate-500 hover:text-slate-300 hover:border-slate-400 text-[10px] font-bold leading-none transition-colors"
      >
        ?
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-56 bg-[#1e293b] border border-slate-700 rounded-lg p-3 shadow-xl z-50">
          <p className="text-slate-300 text-xs leading-relaxed">{text}</p>
        </div>
      )}
    </span>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd frontend && npx vitest run src/components/HelpIcon.test.tsx
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/HelpIcon.tsx frontend/src/components/HelpIcon.test.tsx
git commit -m "feat: add HelpIcon component with popover"
```

---

### Task 2: Integrate HelpIcon into JobModal

**Files:**
- Modify: `frontend/src/components/JobModal.tsx`

- [ ] **Step 1: Add import and HelpIcon to each label**

In `frontend/src/components/JobModal.tsx`, add the import after the existing imports:

```tsx
import HelpIcon from './HelpIcon'
```

Then update each label row. Replace the `<span>` label elements as follows:

**Anbieter** (line ~64) — change:
```tsx
<span className="text-slate-400 text-sm">Anbieter</span>
```
to:
```tsx
<span className="flex items-center gap-1.5 text-slate-400 text-sm">
  Anbieter
  <HelpIcon text="Der Sportanbieter, bei dem du den Kurs buchen möchtest." />
</span>
```

**Wochentag** (line ~69) — change:
```tsx
<span className="text-slate-400 text-sm">Wochentag</span>
```
to:
```tsx
<span className="flex items-center gap-1.5 text-slate-400 text-sm">
  Wochentag
  <HelpIcon text="Der Wochentag, an dem der Kurs regelmäßig stattfindet." />
</span>
```

**Uhrzeit** (line ~83) — change:
```tsx
<span className="text-slate-400 text-sm">Uhrzeit</span>
```
to:
```tsx
<span className="flex items-center gap-1.5 text-slate-400 text-sm">
  Uhrzeit
  <HelpIcon text="Die Startzeit des Kurses. Wird auch genutzt, um passende Kurse in der Auswahl zu filtern." />
</span>
```

**Kursname** (line ~95) — change:
```tsx
<span className="text-slate-400 text-sm">Kursname</span>
```
to:
```tsx
<span className="flex items-center gap-1.5 text-slate-400 text-sm">
  Kursname
  <HelpIcon text="Der Name des Kurses, der gebucht werden soll. Leer lassen, um den ersten verfügbaren Kurs zu diesem Zeitpunkt zu buchen." />
</span>
```

**Tage im Voraus** (line ~103) — change:
```tsx
<span className="text-slate-400 text-sm">Tage im Voraus</span>
```
to:
```tsx
<span className="flex items-center gap-1.5 text-slate-400 text-sm">
  Tage im Voraus
  <HelpIcon text="Wie viele Tage vor dem Kurs soll die Buchung ausgelöst werden? Eversports öffnet Buchungsslots typischerweise einige Tage im Voraus — stelle den Wert passend zum Anbieter ein." />
</span>
```

**Einmalig** (line ~117) — change:
```tsx
<span className="text-slate-300 text-sm">Einmalig</span>
```
to:
```tsx
<span className="flex items-center gap-1.5 text-slate-300 text-sm">
  Einmalig
  <HelpIcon text="Aktiviert: nur einmal ausführen, dann automatisch löschen. Deaktiviert: jede Woche wiederholen." />
</span>
```

**Test** (line ~134, Admin only) — change:
```tsx
<span className="text-slate-300 text-sm">Test <span className="text-slate-500 text-xs">(Buchung wird sofort storniert)</span></span>
```
to:
```tsx
<span className="flex items-center gap-1.5 text-slate-300 text-sm">
  Test <span className="text-slate-500 text-xs">(Buchung wird sofort storniert)</span>
  <HelpIcon text="Testmodus — die Buchung wird sofort nach Abschluss wieder storniert." />
</span>
```

- [ ] **Step 2: Run all frontend tests to verify nothing broke**

```bash
cd frontend && npx vitest run
```

Expected: All tests PASS (existing JobModal tests + new HelpIcon tests).

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/JobModal.tsx
git commit -m "feat: add help icons to all JobModal fields"
```
