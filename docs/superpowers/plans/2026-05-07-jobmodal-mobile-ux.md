# JobModal Mobile UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Das Buchungsformular für mobile Nutzung optimieren: Inline-Labels, Wochentag-Segmented-Controls und ein Stepper für „Tage im Voraus".

**Architecture:** Zwei neue `ui/`-Primitives (`WeekdaySelector`, `Stepper`) werden per TDD gebaut und in `ui/index.ts` exportiert. Danach wird `JobModal.tsx` auf das Inline-Label-Pattern umgestellt und die alten Eingabefelder werden durch die neuen Komponenten ersetzt.

**Tech Stack:** React 18, TypeScript, Tailwind CSS (mit CSS-Variablen wie `--color-brand`, `--color-surface-input`), Vitest + Testing Library

---

## Dateistruktur

| Datei | Aktion | Inhalt |
|---|---|---|
| `frontend/src/components/ui/WeekdaySelector.tsx` | Neu | 7-Button-Selector mit Longpress-Tooltip |
| `frontend/src/components/ui/WeekdaySelector.test.tsx` | Neu | Tests für WeekdaySelector |
| `frontend/src/components/ui/Stepper.tsx` | Neu | Numerischer Stepper mit Direkteingabe |
| `frontend/src/components/ui/Stepper.test.tsx` | Neu | Tests für Stepper |
| `frontend/src/components/ui/index.ts` | Ändern | Exports für die zwei neuen Komponenten |
| `frontend/src/components/JobModal.tsx` | Ändern | Inline-Labels, WeekdaySelector, Stepper |
| `frontend/src/components/JobModal.test.tsx` | Ändern | Tests an neue Struktur anpassen |

---

## Task 1: WeekdaySelector

**Files:**
- Create: `frontend/src/components/ui/WeekdaySelector.test.tsx`
- Create: `frontend/src/components/ui/WeekdaySelector.tsx`

- [ ] **Step 1: Testdatei schreiben**

```tsx
// frontend/src/components/ui/WeekdaySelector.test.tsx
import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi } from 'vitest'
import WeekdaySelector from './WeekdaySelector'

describe('WeekdaySelector', () => {
  it('rendert 7 Buttons M D M D F S S', () => {
    render(<WeekdaySelector value={0} onChange={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(7)
    ;['M', 'D', 'M', 'D', 'F', 'S', 'S'].forEach((label, i) =>
      expect(buttons[i]).toHaveTextContent(label)
    )
  })

  it('markiert aktiven Tag mit aria-pressed=true', () => {
    render(<WeekdaySelector value={2} onChange={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons[2]).toHaveAttribute('aria-pressed', 'true')
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'false')
  })

  it('ruft onChange mit korrektem Index auf bei kurzem Tap', () => {
    const onChange = vi.fn()
    render(<WeekdaySelector value={0} onChange={onChange} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.pointerDown(buttons[4])
    fireEvent.pointerUp(buttons[4])
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('ruft onChange nicht auf bei Longpress', () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    render(<WeekdaySelector value={0} onChange={onChange} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.pointerDown(buttons[1])
    act(() => { vi.advanceTimersByTime(600) })
    fireEvent.pointerUp(buttons[1])
    expect(onChange).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('zeigt Tooltip mit vollem Wochentagsnamen nach Longpress', () => {
    vi.useFakeTimers()
    render(<WeekdaySelector value={0} onChange={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.pointerDown(buttons[2])
    act(() => { vi.advanceTimersByTime(600) })
    expect(screen.getByText('Mittwoch')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('blendet Tooltip beim Loslassen aus', () => {
    vi.useFakeTimers()
    render(<WeekdaySelector value={0} onChange={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.pointerDown(buttons[2])
    act(() => { vi.advanceTimersByTime(600) })
    fireEvent.pointerUp(buttons[2])
    expect(screen.queryByText('Mittwoch')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('zeigt keinen Tooltip bei kurzem Tap', () => {
    vi.useFakeTimers()
    render(<WeekdaySelector value={0} onChange={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.pointerDown(buttons[0])
    act(() => { vi.advanceTimersByTime(100) })
    fireEvent.pointerUp(buttons[0])
    expect(screen.queryByText('Montag')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Tests ausführen — erwarte FAIL**

```bash
cd frontend && npm test -- WeekdaySelector
```

Erwartetes Ergebnis: Fehler `Cannot find module './WeekdaySelector'`

- [ ] **Step 3: WeekdaySelector implementieren**

```tsx
// frontend/src/components/ui/WeekdaySelector.tsx
import { useState, useRef } from 'react'
import { WEEKDAY_NAMES } from '../../types'

const LABELS = ['M', 'D', 'M', 'D', 'F', 'S', 'S']
const LONGPRESS_MS = 500
const AUTOHIDE_MS = 1500

interface Props {
  value: number
  onChange: (day: number) => void
}

export default function WeekdaySelector({ value, onChange }: Props) {
  const [tooltip, setTooltip] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoHideRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  function handlePointerDown(i: number) {
    didLongPress.current = false
    timerRef.current = setTimeout(() => {
      didLongPress.current = true
      setTooltip(i)
      autoHideRef.current = setTimeout(() => setTooltip(null), AUTOHIDE_MS)
    }, LONGPRESS_MS)
  }

  function handlePointerUp(i: number) {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (autoHideRef.current) clearTimeout(autoHideRef.current)
    if (!didLongPress.current) onChange(i)
    setTooltip(null)
    didLongPress.current = false
  }

  function handlePointerCancel() {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (autoHideRef.current) clearTimeout(autoHideRef.current)
    setTooltip(null)
    didLongPress.current = false
  }

  return (
    <div
      role="group"
      aria-label="Wochentag"
      className="flex gap-1 overflow-x-auto"
      style={{ scrollbarWidth: 'none' }}
    >
      {LABELS.map((label, i) => (
        <div key={i} className="relative shrink-0">
          {tooltip === i && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-700 text-white text-xs rounded whitespace-nowrap z-10 pointer-events-none">
              {WEEKDAY_NAMES[i]}
            </div>
          )}
          <button
            type="button"
            aria-pressed={value === i}
            onPointerDown={() => handlePointerDown(i)}
            onPointerUp={() => handlePointerUp(i)}
            onPointerCancel={handlePointerCancel}
            className={`w-[30px] h-[30px] rounded-md text-xs font-bold select-none ${
              value === i
                ? 'bg-brand text-white'
                : 'bg-surface-card text-slate-500 border border-[#0d3336]'
            }`}
          >
            {label}
          </button>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Tests ausführen — erwarte PASS**

```bash
cd frontend && npm test -- WeekdaySelector
```

Erwartetes Ergebnis: 7 Tests bestanden

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/WeekdaySelector.tsx frontend/src/components/ui/WeekdaySelector.test.tsx
git commit -m "feat: add WeekdaySelector ui primitive with longpress tooltip"
```

---

## Task 2: Stepper

**Files:**
- Create: `frontend/src/components/ui/Stepper.test.tsx`
- Create: `frontend/src/components/ui/Stepper.tsx`

- [ ] **Step 1: Testdatei schreiben**

```tsx
// frontend/src/components/ui/Stepper.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import Stepper from './Stepper'

describe('Stepper', () => {
  it('zeigt aktuellen Wert', () => {
    render(<Stepper value={4} onChange={vi.fn()} min={1} max={30} aria-label="Tage im Voraus" />)
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('ruft onChange mit Wert+1 auf bei Klick auf +', () => {
    const onChange = vi.fn()
    render(<Stepper value={4} onChange={onChange} min={1} max={30} aria-label="Tage im Voraus" />)
    fireEvent.click(screen.getByText('+'))
    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('ruft onChange mit Wert-1 auf bei Klick auf −', () => {
    const onChange = vi.fn()
    render(<Stepper value={4} onChange={onChange} min={1} max={30} aria-label="Tage im Voraus" />)
    fireEvent.click(screen.getByText('−'))
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('geht nicht unter min', () => {
    const onChange = vi.fn()
    render(<Stepper value={1} onChange={onChange} min={1} max={30} aria-label="Tage im Voraus" />)
    fireEvent.click(screen.getByText('−'))
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('geht nicht über max', () => {
    const onChange = vi.fn()
    render(<Stepper value={30} onChange={onChange} min={1} max={30} aria-label="Tage im Voraus" />)
    fireEvent.click(screen.getByText('+'))
    expect(onChange).toHaveBeenCalledWith(30)
  })

  it('wechselt in Edit-Modus bei Klick auf Zahl', () => {
    render(<Stepper value={4} onChange={vi.fn()} min={1} max={30} aria-label="Tage im Voraus" />)
    fireEvent.click(screen.getByText('4'))
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
  })

  it('speichert Direkteingabe bei Enter', () => {
    const onChange = vi.fn()
    render(<Stepper value={4} onChange={onChange} min={1} max={30} aria-label="Tage im Voraus" />)
    fireEvent.click(screen.getByText('4'))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '7' } })
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(7)
  })

  it('speichert Direkteingabe bei Blur', () => {
    const onChange = vi.fn()
    render(<Stepper value={4} onChange={onChange} min={1} max={30} aria-label="Tage im Voraus" />)
    fireEvent.click(screen.getByText('4'))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '12' } })
    fireEvent.blur(screen.getByRole('spinbutton'))
    expect(onChange).toHaveBeenCalledWith(12)
  })

  it('clipped Wert auf max bei zu großer Eingabe', () => {
    const onChange = vi.fn()
    render(<Stepper value={4} onChange={onChange} min={1} max={30} aria-label="Tage im Voraus" />)
    fireEvent.click(screen.getByText('4'))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '99' } })
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(30)
  })

  it('verwirft leere Eingabe — alter Wert bleibt', () => {
    const onChange = vi.fn()
    render(<Stepper value={4} onChange={onChange} min={1} max={30} aria-label="Tage im Voraus" />)
    fireEvent.click(screen.getByText('4'))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } })
    fireEvent.blur(screen.getByRole('spinbutton'))
    expect(onChange).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Tests ausführen — erwarte FAIL**

```bash
cd frontend && npm test -- Stepper
```

Erwartetes Ergebnis: Fehler `Cannot find module './Stepper'`

- [ ] **Step 3: Stepper implementieren**

```tsx
// frontend/src/components/ui/Stepper.tsx
import { useState, useRef } from 'react'
import type { KeyboardEvent } from 'react'

interface Props {
  value: number
  onChange: (n: number) => void
  min: number
  max: number
  'aria-label'?: string
}

export default function Stepper({ value, onChange, min, max, 'aria-label': ariaLabel }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setDraft(String(value))
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function commitEdit() {
    const n = parseInt(draft, 10)
    if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)))
    setEditing(false)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') setEditing(false)
  }

  const sideBtnClass =
    'w-[30px] h-[30px] text-slate-400 bg-surface-card border border-[#0d3336] text-base flex items-center justify-center'

  return (
    <div role="group" aria-label={ariaLabel} className="flex items-center">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className={`${sideBtnClass} rounded-l-md border-r-0`}
      >
        −
      </button>
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          value={draft}
          min={min}
          max={max}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className="w-8 h-[30px] text-center text-sm font-semibold text-white bg-surface-input border-y border-[#0d3336] outline-none [color-scheme:dark]"
        />
      ) : (
        <button
          type="button"
          onClick={startEdit}
          className="min-w-8 h-[30px] px-1 text-center text-sm font-semibold text-white bg-surface-input border-y border-[#0d3336]"
        >
          {value}
        </button>
      )}
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className={`${sideBtnClass} rounded-r-md border-l-0`}
      >
        +
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Tests ausführen — erwarte PASS**

```bash
cd frontend && npm test -- Stepper
```

Erwartetes Ergebnis: 10 Tests bestanden

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ui/Stepper.tsx frontend/src/components/ui/Stepper.test.tsx
git commit -m "feat: add Stepper ui primitive with inline edit mode"
```

---

## Task 3: ui/index.ts — Exports ergänzen

**Files:**
- Modify: `frontend/src/components/ui/index.ts`

- [ ] **Step 1: Zwei neue Exports hinzufügen**

```ts
// frontend/src/components/ui/index.ts  (vollständige Datei)
export { default as Button } from './Button'
export type { ButtonVariant, ButtonSize } from './Button'
export { default as Input } from './Input'
export type { InputVariant } from './Input'
export { default as ModalShell } from './ModalShell'
export { default as WeekdaySelector } from './WeekdaySelector'
export { default as Stepper } from './Stepper'
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ui/index.ts
git commit -m "chore: export WeekdaySelector and Stepper from ui"
```

---

## Task 4: JobModal — Inline-Labels, WeekdaySelector, Stepper

**Files:**
- Modify: `frontend/src/components/JobModal.tsx`
- Modify: `frontend/src/components/JobModal.test.tsx`

- [ ] **Step 1: JobModal.tsx umschreiben**

Das gesamte `<form>`-JSX ersetzen. Jede Zeile folgt dem Pattern:

```
<div className="flex items-center gap-3 bg-surface-input rounded-lg px-3 py-2">
  <span className="flex items-center gap-1 text-slate-500 text-xs w-20 shrink-0">
    Label <HelpIcon text="..." />
  </span>
  {/* Eingabe rechts */}
</div>
```

Für FacilityCombobox und CourseCombobox entfällt der `bg-surface-input`-Wrapper, da diese eigene Eingabe-Styling mitbringen — das äußere `div` hat nur `flex items-center gap-3 py-1`.

Vollständige neue `JobModal.tsx`:

```tsx
import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import type { Job, JobFormData, Facility } from '../types'
import FacilityCombobox from './FacilityCombobox'
import CourseCombobox from './CourseCombobox'
import HelpIcon from './HelpIcon'
import { getCourses } from '../api/facilities'
import { isAdmin } from '../api/client'
import { Button, Input, ModalShell, WeekdaySelector, Stepper } from './ui'

interface Props {
  job?: Job
  onSave: (data: JobFormData) => Promise<void>
  onClose: () => void
  error?: string | null
}

export default function JobModal({ job, onSave, onClose, error }: Props) {
  const [weekday, setWeekday] = useState(job?.weekday ?? 0)
  const [targetTime, setTargetTime] = useState(job?.target_time.slice(0, 5) ?? '18:00')
  const [facility, setFacility] = useState<Facility | null>(
    job ? { id: job.facility_id, name: job.facility_name } : null
  )
  const [className, setClassName] = useState(job?.class_name ?? '')
  const [daysInAdvance, setDaysInAdvance] = useState(job?.days_in_advance ?? 4)
  const [oneTime, setOneTime] = useState(job?.one_time ?? false)
  const [debug, setDebug] = useState(job?.debug ?? false)
  const [courses, setCourses] = useState<string[]>([])
  const [isLoadingCourses, setIsLoadingCourses] = useState(false)

  const isInitialMount = useRef(true)

  useEffect(() => {
    if (!facility) {
      setCourses([])
      setIsLoadingCourses(false)
      return
    }
    let cancelled = false
    setCourses([])
    setIsLoadingCourses(true)
    getCourses(facility.id, weekday, targetTime)
      .then(data => { if (!cancelled) { setCourses(data); setIsLoadingCourses(false) } })
      .catch(() => { if (!cancelled) { setCourses([]); setIsLoadingCourses(false) } })
    if (!isInitialMount.current) setClassName('')
    isInitialMount.current = false
    return () => { cancelled = true }
  }, [facility?.id, weekday, targetTime])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!facility) return
    await onSave({
      weekday,
      target_time: targetTime,
      facility_id: facility.id,
      facility_name: facility.name,
      class_name: className,
      days_in_advance: Number(daysInAdvance),
      one_time: oneTime,
      ...(isAdmin() ? { debug } : {}),
    })
  }

  const rowClass = 'flex items-center gap-3 bg-surface-input rounded-lg px-3 py-2'
  const labelClass = 'flex items-center gap-1 text-slate-500 text-xs w-20 shrink-0'

  return (
    <ModalShell>
      <h2 className="text-white font-bold text-lg mb-4">
        {job ? 'Geplante Buchung bearbeiten' : 'Neue Buchung planen'}
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">

        <div className="flex items-center gap-3 py-1">
          <span className={labelClass}>
            Anbieter
            <HelpIcon text="Der Sportanbieter, bei dem du den Kurs buchen möchtest." />
          </span>
          <div className="flex-1 min-w-0">
            <FacilityCombobox value={facility} onChange={setFacility} />
          </div>
        </div>

        <div className={rowClass}>
          <span className={labelClass}>
            Wochentag
            <HelpIcon text="Der Wochentag, an dem der Kurs regelmäßig stattfindet." />
          </span>
          <WeekdaySelector value={weekday} onChange={setWeekday} />
        </div>

        <div className={rowClass}>
          <span className={labelClass}>
            Uhrzeit
            <HelpIcon text="Die Startzeit des Kurses. Wird auch genutzt, um passende Kurse in der Auswahl zu filtern." />
          </span>
          <Input
            aria-label="Uhrzeit"
            type="time"
            value={targetTime}
            onChange={e => setTargetTime(e.target.value)}
            required
          />
        </div>

        <div className="flex items-center gap-3 py-1">
          <span className={labelClass}>
            Kursname
            <HelpIcon text="Der Name des Kurses, der gebucht werden soll. Leer lassen, um den ersten verfügbaren Kurs zu diesem Zeitpunkt zu buchen." />
          </span>
          <div className="flex-1 min-w-0">
            <CourseCombobox
              value={className}
              onChange={setClassName}
              facilityCourses={courses}
              isLoading={isLoadingCourses}
              canSearch={!!facility}
            />
          </div>
        </div>

        <div className={rowClass}>
          <span className={labelClass}>
            Tage voraus
            <HelpIcon text="Wie viele Tage vor dem Kurs soll die Buchung ausgelöst werden? Eversports öffnet Buchungsslots typischerweise einige Tage im Voraus — stelle den Wert passend zum Anbieter ein." />
          </span>
          <Stepper
            aria-label="Tage im Voraus"
            value={daysInAdvance}
            onChange={setDaysInAdvance}
            min={1}
            max={30}
          />
        </div>

        <div className={rowClass}>
          <span className={labelClass}>
            Einmalig
            <HelpIcon text="Aktiviert: nur einmal ausführen, dann automatisch löschen. Deaktiviert: jede Woche wiederholen." />
          </span>
          <input
            aria-label="Einmalig"
            type="checkbox"
            checked={oneTime}
            onChange={e => setOneTime(e.target.checked)}
            className="w-4 h-4 rounded accent-brand"
          />
        </div>

        {isAdmin() && (
          <div className={rowClass}>
            <span className={labelClass}>
              Test
              <HelpIcon text="Testmodus — die Buchung wird sofort nach Abschluss wieder storniert." />
            </span>
            <input
              aria-label="Test"
              type="checkbox"
              checked={debug}
              onChange={e => setDebug(e.target.checked)}
              className="w-4 h-4 rounded accent-brand"
            />
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 justify-end mt-2">
          <Button variant="primary" type="submit" disabled={!facility}>
            Speichern
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
        </div>
      </form>
    </ModalShell>
  )
}
```

- [ ] **Step 2: JobModal.test.tsx aktualisieren**

Die Tests müssen an die neue Struktur angepasst werden. Der `<select aria-label="Wochentag">` ist weg (jetzt `role="group"`), der `<input type="number">` ist weg (jetzt Stepper mit `role="group"`).

```tsx
// frontend/src/components/JobModal.test.tsx
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi } from 'vitest'
import JobModal from './JobModal'

vi.mock('../api/client', () => ({
  isAdmin: vi.fn(() => false),
  apiFetch: vi.fn(),
}))

vi.mock('../api/facilities', () => ({
  getCourses: vi.fn(() => Promise.resolve([])),
}))

const jobWithFacility = {
  id: 'j1', weekday: 1, target_time: '18:00:00', facility_id: '73041',
  facility_name: 'CrossFit Rabbit Hole', class_name: 'CrossFit', days_in_advance: 4,
  enabled: true, one_time: false, created_at: '', debug: false,
}

describe('JobModal', () => {
  const onSave = vi.fn()
  const onClose = vi.fn()

  it('rendert alle Formularfelder', () => {
    render(<JobModal onSave={onSave} onClose={onClose} />)
    const facilityCombos = screen.getAllByRole('textbox')
    expect(facilityCombos.find(el => (el as HTMLInputElement).placeholder?.includes('Anbieter'))).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Wochentag' })).toBeInTheDocument()
    expect(screen.getByLabelText('Uhrzeit', { selector: 'input' })).toBeInTheDocument()
    expect(screen.getByLabelText('Kursname', { selector: 'input' })).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Tage im Voraus' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Einmalig' })).toBeInTheDocument()
  })

  it('rendert Einmalig-Checkbox deaktiviert per default', () => {
    render(<JobModal onSave={onSave} onClose={onClose} />)
    expect((screen.getByRole('checkbox', { name: /einmalig/i }) as HTMLInputElement).checked).toBe(false)
  })

  it('ruft onSave mit one_time false per default auf', async () => {
    render(<JobModal job={jobWithFacility} onSave={onSave} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /speichern/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ one_time: false })
    ))
  })

  it('ruft onSave mit one_time true auf wenn Checkbox aktiviert', async () => {
    render(<JobModal job={jobWithFacility} onSave={onSave} onClose={onClose} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /einmalig/i }))
    fireEvent.click(screen.getByRole('button', { name: /speichern/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ one_time: true })
    ))
  })

  it('befüllt Felder beim Bearbeiten einer vorhandenen Buchung', () => {
    const job = {
      id: 'j1', weekday: 2, target_time: '09:00:00', facility_id: '73041',
      facility_name: 'CrossFit Rabbit Hole', class_name: 'Yoga', days_in_advance: 3,
      enabled: true, one_time: true, created_at: '', debug: false,
    }
    render(<JobModal job={job} onSave={onSave} onClose={onClose} />)

    // Kursname
    const kursInput = screen.getByLabelText('Kursname', { selector: 'input' }) as HTMLInputElement
    expect(kursInput.value).toBe('Yoga')

    // Stepper zeigt den Wert 3
    const stepperGroup = screen.getByRole('group', { name: 'Tage im Voraus' })
    expect(within(stepperGroup).getByText('3')).toBeInTheDocument()

    // Wochentag: Mittwoch (Index 2) ist aktiv
    const weekdayGroup = screen.getByRole('group', { name: 'Wochentag' })
    const dayButtons = within(weekdayGroup).getAllByRole('button')
    expect(dayButtons[2]).toHaveAttribute('aria-pressed', 'true')

    // Einmalig ist aktiviert
    expect((screen.getByRole('checkbox', { name: 'Einmalig' }) as HTMLInputElement).checked).toBe(true)
  })

  it('ruft onClose auf wenn Abbrechen geklickt', () => {
    render(<JobModal onSave={onSave} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /abbrechen/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Step 3: Alle Tests ausführen — erwarte PASS**

```bash
cd frontend && npm test
```

Erwartetes Ergebnis: Alle Tests bestanden. Wenn Tests wegen der `Input`-Komponente im Uhrzeit-Feld fehlschlagen (weil `Input` jetzt `w-full` hat und das im inline-row-Container zu breit wirkt), `w-full` in `Input` für `type="time"` überschreiben: `className` prop auf `Input` ist nicht verfügbar (locked), daher Uhrzeit-Zeile als direktes `<input>` mit den Input-Varianten-Klassen rendern statt via `<Input>`-Komponente:

```tsx
// Alternativer Ansatz für Uhrzeit falls Input-Styling stört:
<input
  aria-label="Uhrzeit"
  type="time"
  value={targetTime}
  onChange={e => setTargetTime(e.target.value)}
  required
  className="bg-surface-input text-white rounded-lg px-3 py-2 outline-hidden focus:ring-2 focus:ring-brand [color-scheme:dark]"
/>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/JobModal.tsx frontend/src/components/JobModal.test.tsx
git commit -m "feat: redesign JobModal with inline labels, WeekdaySelector and Stepper"
```
