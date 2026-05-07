# Primitive UI-Komponenten – Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drei primitive UI-Komponenten (`Button`, `Input`, `ModalShell`) in `src/components/ui/` erstellen und in 13 bestehenden Komponenten einsetzen, um duplizierte Tailwind-Klassen zu konsolidieren.

**Architecture:** Neue Dateien unter `frontend/src/components/ui/`. Jede Komponente hat ein striktes Variant-API ohne `className`-Escape. Migration erfolgt Datei für Datei; bestehende Tests dienen als Regressions-Suite.

**Tech Stack:** React 19, TypeScript 6, Tailwind v4, Vitest, @testing-library/react

---

## Dateiübersicht

| Aktion | Pfad |
|---|---|
| Erstellen | `frontend/src/components/ui/Button.tsx` |
| Erstellen | `frontend/src/components/ui/Button.test.tsx` |
| Erstellen | `frontend/src/components/ui/Input.tsx` |
| Erstellen | `frontend/src/components/ui/Input.test.tsx` |
| Erstellen | `frontend/src/components/ui/ModalShell.tsx` |
| Erstellen | `frontend/src/components/ui/ModalShell.test.tsx` |
| Erstellen | `frontend/src/components/ui/index.ts` |
| Ändern | `frontend/src/components/LoginModal.tsx` |
| Ändern | `frontend/src/components/JobModal.tsx` |
| Ändern | `frontend/src/components/SettingsModal.tsx` |
| Ändern | `frontend/src/components/JobCard.tsx` |
| Ändern | `frontend/src/components/BookedAppointmentCard.tsx` |
| Ändern | `frontend/src/components/FacilityCombobox.tsx` |
| Ändern | `frontend/src/components/CourseCombobox.tsx` |
| Ändern | `frontend/src/components/UserManagementSection.tsx` |
| Ändern | `frontend/src/components/AllJobsSection.tsx` |
| Ändern | `frontend/src/components/AllLogsSection.tsx` |
| Ändern | `frontend/src/components/TestEmailModal.tsx` |

**Nicht migriert:** `FaqModal`, `ImprintModal` (nutzen `max-w-lg`, `max-h-[80vh]`, `overflow-y-auto` — zu spezifisch), `LogDrawer` (Error-Dialog nutzt `z-60` über dem Drawer mit `z-50`).

---

## Task 1: `Button`-Komponente erstellen

**Files:**
- Create: `frontend/src/components/ui/Button.tsx`
- Create: `frontend/src/components/ui/Button.test.tsx`

- [ ] **Schritt 1: Test schreiben**

Datei `frontend/src/components/ui/Button.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import Button from './Button'

describe('Button', () => {
  it('rendert children', () => {
    render(<Button variant="primary">Speichern</Button>)
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeInTheDocument()
  })

  it('ist nicht disabled per default', () => {
    render(<Button variant="primary">Speichern</Button>)
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('ist disabled wenn disabled-Prop gesetzt', () => {
    render(<Button variant="primary" disabled>Speichern</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('ist disabled wenn loading', () => {
    render(<Button variant="primary" loading>Speichern</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('zeigt Spinner wenn loading', () => {
    const { container } = render(<Button variant="primary" loading>Speichern</Button>)
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('zeigt keinen Spinner ohne loading', () => {
    const { container } = render(<Button variant="primary">Speichern</Button>)
    expect(container.querySelector('.animate-spin')).not.toBeInTheDocument()
  })

  it('ruft onClick auf wenn geklickt', () => {
    const onClick = vi.fn()
    render(<Button variant="primary" onClick={onClick}>Speichern</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('ruft onClick nicht auf wenn disabled', () => {
    const onClick = vi.fn()
    render(<Button variant="primary" disabled onClick={onClick}>Speichern</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('hat type=button per default', () => {
    render(<Button variant="primary">Speichern</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('nutzt type=submit wenn angegeben', () => {
    render(<Button variant="primary" type="submit">Speichern</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })

  it('setzt aria-label wenn übergeben', () => {
    render(<Button variant="danger" size="sm" aria-label="Buchung löschen">✕</Button>)
    expect(screen.getByRole('button', { name: 'Buchung löschen' })).toBeInTheDocument()
  })
})
```

- [ ] **Schritt 2: Test scheitern lassen**

```bash
cd frontend && npm test -- Button.test
```
Erwartetes Ergebnis: FAIL — `Cannot find module './Button'`

- [ ] **Schritt 3: Komponente implementieren**

Datei `frontend/src/components/ui/Button.tsx`:

```tsx
import type { ReactNode, MouseEvent } from 'react'

export type ButtonVariant = 'primary' | 'ghost' | 'secondary' | 'danger' | 'slate'
export type ButtonSize = 'sm' | 'md'

interface ButtonProps {
  variant: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  'aria-label'?: string
  children: ReactNode
}

const BASE = 'inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand hover:bg-brand-hover text-white font-semibold rounded-lg',
  ghost:   'text-slate-400 hover:text-white',
  secondary: 'bg-surface-card border border-slate-700 text-slate-400 hover:enabled:bg-slate-700 rounded-md',
  danger:  'bg-red-900 hover:bg-red-700 text-red-300 rounded-lg',
  slate:   'bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1 text-sm',
  md: 'px-4 py-2 text-sm',
}

export default function Button({
  variant,
  size = 'md',
  loading = false,
  fullWidth = false,
  type = 'button',
  disabled = false,
  onClick,
  'aria-label': ariaLabel,
  children,
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={ariaLabel}
      className={[BASE, VARIANTS[variant], SIZES[size], fullWidth ? 'w-full' : ''].filter(Boolean).join(' ')}
    >
      {loading && (
        <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
      )}
      {children}
    </button>
  )
}
```

- [ ] **Schritt 4: Tests laufen lassen**

```bash
cd frontend && npm test -- Button.test
```
Erwartetes Ergebnis: alle 11 Tests PASS

- [ ] **Schritt 5: Committen**

```bash
git add frontend/src/components/ui/Button.tsx frontend/src/components/ui/Button.test.tsx
git commit -m "feat: add Button primitive UI component"
```

---

## Task 2: `Input`-Komponente erstellen

**Files:**
- Create: `frontend/src/components/ui/Input.tsx`
- Create: `frontend/src/components/ui/Input.test.tsx`

- [ ] **Schritt 1: Test schreiben**

Datei `frontend/src/components/ui/Input.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import Input from './Input'

describe('Input', () => {
  it('rendert mit placeholder', () => {
    render(<Input placeholder="E-Mail" />)
    expect(screen.getByPlaceholderText('E-Mail')).toBeInTheDocument()
  })

  it('reicht type-Prop durch', () => {
    render(<Input type="email" placeholder="E-Mail" />)
    expect(screen.getByPlaceholderText('E-Mail')).toHaveAttribute('type', 'email')
  })

  it('reicht required-Prop durch', () => {
    render(<Input required placeholder="Pflichtfeld" />)
    expect(screen.getByPlaceholderText('Pflichtfeld')).toBeRequired()
  })

  it('reicht aria-label durch', () => {
    render(<Input aria-label="Tage im Voraus" type="number" />)
    expect(screen.getByRole('spinbutton', { name: 'Tage im Voraus' })).toBeInTheDocument()
  })

  it('reicht min und max durch', () => {
    render(<Input type="number" min={1} max={30} aria-label="Tage" />)
    const input = screen.getByRole('spinbutton', { name: 'Tage' })
    expect(input).toHaveAttribute('min', '1')
    expect(input).toHaveAttribute('max', '30')
  })

  it('reicht autoFocus durch', () => {
    render(<Input autoFocus aria-label="Suche" />)
    expect(screen.getByRole('textbox', { name: 'Suche' })).toHaveFocus()
  })
})
```

- [ ] **Schritt 2: Test scheitern lassen**

```bash
cd frontend && npm test -- Input.test
```
Erwartetes Ergebnis: FAIL — `Cannot find module './Input'`

- [ ] **Schritt 3: Komponente implementieren**

Datei `frontend/src/components/ui/Input.tsx`:

```tsx
import type { InputHTMLAttributes } from 'react'

export type InputVariant = 'default' | 'filter'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  variant?: InputVariant
}

const AUTOFILL = '[&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_var(--color-surface-input)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:white]'

const VARIANTS: Record<InputVariant, string> = {
  default: `bg-surface-input text-white rounded-lg px-3 py-2 w-full outline-hidden focus:ring-2 focus:ring-brand [color-scheme:dark] ${AUTOFILL}`,
  filter:  `bg-surface-card border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 w-full [color-scheme:dark] ${AUTOFILL}`,
}

export default function Input({ variant = 'default', ...props }: InputProps) {
  return <input className={VARIANTS[variant]} {...props} />
}
```

- [ ] **Schritt 4: Tests laufen lassen**

```bash
cd frontend && npm test -- Input.test
```
Erwartetes Ergebnis: alle 6 Tests PASS

- [ ] **Schritt 5: Committen**

```bash
git add frontend/src/components/ui/Input.tsx frontend/src/components/ui/Input.test.tsx
git commit -m "feat: add Input primitive UI component"
```

---

## Task 3: `ModalShell`-Komponente erstellen

**Files:**
- Create: `frontend/src/components/ui/ModalShell.tsx`
- Create: `frontend/src/components/ui/ModalShell.test.tsx`

- [ ] **Schritt 1: Test schreiben**

Datei `frontend/src/components/ui/ModalShell.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import ModalShell from './ModalShell'

describe('ModalShell', () => {
  it('rendert children', () => {
    render(<ModalShell><p>Inhalt</p></ModalShell>)
    expect(screen.getByText('Inhalt')).toBeInTheDocument()
  })

  it('ruft onBackdropClick auf wenn Backdrop geklickt', () => {
    const onBackdropClick = vi.fn()
    const { container } = render(
      <ModalShell onBackdropClick={onBackdropClick}><p>Inhalt</p></ModalShell>
    )
    fireEvent.click(container.firstChild!)
    expect(onBackdropClick).toHaveBeenCalledTimes(1)
  })

  it('ruft onBackdropClick nicht auf wenn innerer Inhalt geklickt', () => {
    const onBackdropClick = vi.fn()
    render(
      <ModalShell onBackdropClick={onBackdropClick}><p>Inhalt</p></ModalShell>
    )
    fireEvent.click(screen.getByText('Inhalt'))
    expect(onBackdropClick).not.toHaveBeenCalled()
  })

  it('wirft keinen Fehler ohne onBackdropClick', () => {
    const { container } = render(<ModalShell><p>Inhalt</p></ModalShell>)
    expect(() => fireEvent.click(container.firstChild!)).not.toThrow()
  })

  it('setzt data-testid auf Backdrop wenn testId übergeben', () => {
    render(<ModalShell testId="mein-modal"><p>Inhalt</p></ModalShell>)
    expect(screen.getByTestId('mein-modal')).toBeInTheDocument()
  })
})
```

- [ ] **Schritt 2: Test scheitern lassen**

```bash
cd frontend && npm test -- ModalShell.test
```
Erwartetes Ergebnis: FAIL — `Cannot find module './ModalShell'`

- [ ] **Schritt 3: Komponente implementieren**

Datei `frontend/src/components/ui/ModalShell.tsx`:

```tsx
import type { ReactNode, MouseEvent } from 'react'

interface ModalShellProps {
  onBackdropClick?: () => void
  maxWidth?: 'sm' | 'md'
  testId?: string
  children: ReactNode
}

const MAX_WIDTHS = { sm: 'max-w-sm', md: 'max-w-md' }

export default function ModalShell({
  onBackdropClick,
  maxWidth = 'md',
  testId,
  children,
}: ModalShellProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4"
      data-testid={testId}
      onClick={onBackdropClick}
    >
      <div
        className={`relative bg-surface-card border border-slate-700 rounded-xl w-full ${MAX_WIDTHS[maxWidth]} p-6`}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
```

Hinweis: `relative` auf dem inneren div ermöglicht absolut positionierte Close-Buttons (z.B. in `LoginModal`).

- [ ] **Schritt 4: Tests laufen lassen**

```bash
cd frontend && npm test -- ModalShell.test
```
Erwartetes Ergebnis: alle 5 Tests PASS

- [ ] **Schritt 5: Committen**

```bash
git add frontend/src/components/ui/ModalShell.tsx frontend/src/components/ui/ModalShell.test.tsx
git commit -m "feat: add ModalShell primitive UI component"
```

---

## Task 4: Barrel-Export erstellen und alle neuen Tests ausführen

**Files:**
- Create: `frontend/src/components/ui/index.ts`

- [ ] **Schritt 1: `index.ts` erstellen**

Datei `frontend/src/components/ui/index.ts`:

```ts
export { default as Button } from './Button'
export type { ButtonVariant, ButtonSize } from './Button'
export { default as Input } from './Input'
export type { InputVariant } from './Input'
export { default as ModalShell } from './ModalShell'
```

- [ ] **Schritt 2: Alle neuen Tests ausführen**

```bash
cd frontend && npm test -- ui/
```
Erwartetes Ergebnis: alle 22 Tests PASS (11 Button + 6 Input + 5 ModalShell)

- [ ] **Schritt 3: Committen**

```bash
git add frontend/src/components/ui/index.ts
git commit -m "feat: add ui barrel export"
```

---

## Task 5: `LoginModal` migrieren

**Files:**
- Modify: `frontend/src/components/LoginModal.tsx`

- [ ] **Schritt 1: Baseline prüfen**

```bash
cd frontend && npm test -- LoginModal.test
```
Erwartetes Ergebnis: alle 5 bestehenden Tests PASS

- [ ] **Schritt 2: Migration durchführen**

`frontend/src/components/LoginModal.tsx` komplett ersetzen:

```tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { Button, Input, ModalShell } from './ui'

interface Props {
  onClose: () => void
}

export default function LoginModal({ onClose }: Props) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      onClose()
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      setError(
        msg === 'Account nicht freigegeben'
          ? 'Dein Account wartet auf Freigabe'
          : msg || 'Login fehlgeschlagen'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalShell onBackdropClick={onClose} maxWidth="sm" testId="login-modal-backdrop">
      <button
        type="button"
        aria-label="Schließen"
        onClick={onClose}
        className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
      >
        ✕
      </button>

      <div className="flex justify-center mb-4 mt-2">
        <img src="/logo.png" alt="Logo" className="h-12 w-auto" />
      </div>

      <p className="text-slate-400 text-sm text-center mb-4">
        Nutze deine Eversports Anmeldedaten, um fortzufahren.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          type="email"
          placeholder="E-Mail"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Passwort"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        {error && (
          <p role="alert" className="text-red-400 text-sm">{error}</p>
        )}
        <Button variant="primary" type="submit" loading={loading} fullWidth>
          Anmelden
        </Button>
      </form>
    </ModalShell>
  )
}
```

- [ ] **Schritt 3: Tests ausführen**

```bash
cd frontend && npm test -- LoginModal.test
```
Erwartetes Ergebnis: alle 5 Tests PASS

- [ ] **Schritt 4: Committen**

```bash
git add frontend/src/components/LoginModal.tsx
git commit -m "refactor: migrate LoginModal to use ui primitives"
```

---

## Task 6: `JobModal` migrieren

**Files:**
- Modify: `frontend/src/components/JobModal.tsx`

- [ ] **Schritt 1: Baseline prüfen**

```bash
cd frontend && npm test -- JobModal.test
```
Erwartetes Ergebnis: PASS

- [ ] **Schritt 2: Migration durchführen**

In `frontend/src/components/JobModal.tsx`:

**Import-Zeile hinzufügen** (nach den bestehenden Imports):
```tsx
import { Button, Input, ModalShell } from './ui'
```

**Äußeres div ersetzen** — von:
```tsx
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-surface-card rounded-xl w-full max-w-md p-6">
```
zu:
```tsx
  return (
    <ModalShell>
```
und den schließenden `</div></div>` am Ende durch `</ModalShell>` ersetzen.

**Select-Element** bleibt unverändert (kein `<Input>` für `<select>`).

**Time-Input** ersetzen — von:
```tsx
            <input
              aria-label="Uhrzeit"
              type="time"
              value={targetTime}
              onChange={e => setTargetTime(e.target.value)}
              required
              className="bg-surface-input text-white rounded-lg px-3 py-2 outline-hidden focus:ring-2 focus:ring-brand [color-scheme:dark]"
            />
```
zu:
```tsx
            <Input
              aria-label="Uhrzeit"
              type="time"
              value={targetTime}
              onChange={e => setTargetTime(e.target.value)}
              required
            />
```

**Number-Input** ersetzen — von:
```tsx
            <input
              aria-label="Tage im Voraus"
              type="number"
              min={1}
              max={30}
              value={daysInAdvance}
              onChange={e => setDaysInAdvance(Number(e.target.value))}
              required
              className="bg-surface-input text-white rounded-lg px-3 py-2 outline-hidden focus:ring-2 focus:ring-brand"
            />
```
zu:
```tsx
            <Input
              aria-label="Tage im Voraus"
              type="number"
              min={1}
              max={30}
              value={daysInAdvance}
              onChange={e => setDaysInAdvance(Number(e.target.value))}
              required
            />
```

**Speichern-Button** ersetzen — von:
```tsx
            <button
              type="submit"
              disabled={!facility}
              className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              Speichern
            </button>
```
zu:
```tsx
            <Button variant="primary" type="submit" disabled={!facility}>
              Speichern
            </Button>
```

**Abbrechen-Button** ersetzen — von:
```tsx
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Abbrechen
            </button>
```
zu:
```tsx
            <Button variant="ghost" onClick={onClose}>
              Abbrechen
            </Button>
```

- [ ] **Schritt 3: Tests ausführen**

```bash
cd frontend && npm test -- JobModal.test
```
Erwartetes Ergebnis: alle Tests PASS

- [ ] **Schritt 4: Committen**

```bash
git add frontend/src/components/JobModal.tsx
git commit -m "refactor: migrate JobModal to use ui primitives"
```

---

## Task 7: `SettingsModal` migrieren

**Files:**
- Modify: `frontend/src/components/SettingsModal.tsx`

- [ ] **Schritt 1: Baseline prüfen**

```bash
cd frontend && npm test -- SettingsModal.test
```
Erwartetes Ergebnis: PASS

- [ ] **Schritt 2: Migration durchführen**

In `frontend/src/components/SettingsModal.tsx`:

**Import hinzufügen:**
```tsx
import { Button, Input, ModalShell } from './ui'
```

**Äußeres Modal-Wrapper** ersetzen — von:
```tsx
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-surface-card rounded-xl w-full max-w-md p-6">
```
zu:
```tsx
    <ModalShell>
```
und schließendes `</div></div>` durch `</ModalShell>`.

**Notification-Input** ersetzen. Da dieser `w-32` braucht, in eine Wrapper-div einbetten:
Von:
```tsx
                <input
                  aria-label="Minuten vor dem Termin"
                  type="number"
                  min={15}
                  max={1440}
                  value={advanceMinutes}
                  onChange={(e) => setAdvanceMinutes(Number(e.target.value))}
                  className="bg-surface-input text-white rounded-lg px-3 py-2 outline-hidden focus:ring-2 focus:ring-blue-500 w-32"
                />
```
zu:
```tsx
                <div className="w-32">
                  <Input
                    aria-label="Minuten vor dem Termin"
                    type="number"
                    min={15}
                    max={1440}
                    value={advanceMinutes}
                    onChange={(e) => setAdvanceMinutes(Number(e.target.value))}
                  />
                </div>
```

**Speichern-Button** ersetzen — von:
```tsx
              <button
                onClick={handleSave}
                disabled={saveLoading || advanceMinutes < 15 || advanceMinutes > 1440}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saveLoading ? 'Wird gespeichert…' : 'Speichern'}
              </button>
```
zu:
```tsx
              <Button
                variant="primary"
                loading={saveLoading}
                disabled={advanceMinutes < 15 || advanceMinutes > 1440}
              >
                Speichern
              </Button>
```

**Confirm-Input** ersetzen — von:
```tsx
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="bg-surface-input text-white rounded-lg px-3 py-2 outline-hidden focus:ring-2 focus:ring-red-500 font-mono"
            />
```
zu:
```tsx
            <Input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
            />
```

**Konto-löschen-Button** ersetzen — von:
```tsx
          <button
            onClick={handleDelete}
            disabled={confirmText !== 'DELETE' || deleteLoading}
            className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deleteLoading ? 'Wird gelöscht…' : 'Konto löschen'}
          </button>
```
zu:
```tsx
          <Button
            variant="danger"
            loading={deleteLoading}
            disabled={confirmText !== 'DELETE'}
            fullWidth
          >
            Konto löschen
          </Button>
```

- [ ] **Schritt 3: Tests ausführen**

```bash
cd frontend && npm test -- SettingsModal.test
```
Erwartetes Ergebnis: PASS

- [ ] **Schritt 4: Committen**

```bash
git add frontend/src/components/SettingsModal.tsx
git commit -m "refactor: migrate SettingsModal to use ui primitives"
```

---

## Task 8: `JobCard` migrieren (Edit + Delete Buttons)

**Files:**
- Modify: `frontend/src/components/JobCard.tsx`

Hinweis: "Jetzt buchen"-Button bleibt inline (blauer Sonderfall mit eigenem Spinner-State).

- [ ] **Schritt 1: Baseline prüfen**

```bash
cd frontend && npm test -- JobCard.test
```
Erwartetes Ergebnis: PASS

- [ ] **Schritt 2: Import hinzufügen**

Am Anfang von `frontend/src/components/JobCard.tsx` nach den bestehenden Imports:
```tsx
import { Button } from './ui'
```

- [ ] **Schritt 3: Bearbeiten-Button ersetzen**

Von:
```tsx
        <button
          aria-label="Bearbeiten"
          onClick={() => onEdit(job)}
          disabled={executing}
          className="px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors disabled:opacity-50"
        >
          Bearbeiten
        </button>
```
zu:
```tsx
        <Button
          variant="slate"
          size="sm"
          aria-label="Bearbeiten"
          onClick={() => onEdit(job)}
          disabled={executing}
        >
          Bearbeiten
        </Button>
```

- [ ] **Schritt 4: Löschen-Button ersetzen**

Von:
```tsx
        <button
          aria-label="Löschen"
          onClick={() => onDelete(job.id)}
          disabled={executing}
          className="px-3 py-1 rounded-md bg-red-900 hover:bg-red-700 text-red-300 text-sm transition-colors ml-auto disabled:opacity-50"
        >
          Löschen
        </button>
```
zu:
```tsx
        <div className="ml-auto">
          <Button
            variant="danger"
            size="sm"
            aria-label="Löschen"
            onClick={() => onDelete(job.id)}
            disabled={executing}
          >
            Löschen
          </Button>
        </div>
```

- [ ] **Schritt 5: Tests ausführen**

```bash
cd frontend && npm test -- JobCard.test
```
Erwartetes Ergebnis: alle Tests PASS

- [ ] **Schritt 6: Committen**

```bash
git add frontend/src/components/JobCard.tsx
git commit -m "refactor: migrate JobCard buttons to use ui primitives"
```

---

## Task 9: `BookedAppointmentCard` migrieren

**Files:**
- Modify: `frontend/src/components/BookedAppointmentCard.tsx`

- [ ] **Schritt 1: Import hinzufügen und Button ersetzen**

In `frontend/src/components/BookedAppointmentCard.tsx`:

Import hinzufügen:
```tsx
import { Button } from './ui'
```

Den Cancel-Button (hat `ml-auto`) ersetzen — von:
```tsx
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="px-3 py-1 rounded-md bg-red-900 hover:bg-red-700 text-red-300 text-sm transition-colors ml-auto disabled:opacity-50"
        >
          {cancelling ? 'Wird storniert…' : 'Stornieren'}
        </button>
```
zu:
```tsx
        <div className="ml-auto">
          <Button
            variant="danger"
            size="sm"
            loading={cancelling}
            onClick={handleCancel}
          >
            Stornieren
          </Button>
        </div>
```

- [ ] **Schritt 2: Build-Check**

```bash
cd frontend && npx tsc --noEmit
```
Erwartetes Ergebnis: keine TypeScript-Fehler

- [ ] **Schritt 3: Committen**

```bash
git add frontend/src/components/BookedAppointmentCard.tsx
git commit -m "refactor: migrate BookedAppointmentCard to use ui primitives"
```

---

## Task 10: `FacilityCombobox` und `CourseCombobox` migrieren

**Files:**
- Modify: `frontend/src/components/FacilityCombobox.tsx`
- Modify: `frontend/src/components/CourseCombobox.tsx`

- [ ] **Schritt 1: `FacilityCombobox` migrieren**

In `frontend/src/components/FacilityCombobox.tsx`:

Import hinzufügen:
```tsx
import { Input } from './ui'
```

Die lokale `inputClass`-Konstante entfernen und den `<input>`-Tag ersetzen. Von:
```tsx
  const inputClass = 'bg-surface-input text-white rounded-lg px-3 py-2 outline-hidden focus:ring-2 focus:ring-brand w-full'
  // ...
      <input
        aria-label="Anbieter suchen"
        type="text"
        value={isOpen ? query : (value?.name ?? '')}
        placeholder={value ? value.name : 'Anbieter suchen…'}
        onFocus={() => { setIsOpen(true); setQuery('') }}
        onChange={e => setQuery(e.target.value)}
        className={inputClass}
        autoComplete="off"
      />
```
zu:
```tsx
      <Input
        aria-label="Anbieter suchen"
        type="text"
        value={isOpen ? query : (value?.name ?? '')}
        placeholder={value ? value.name : 'Anbieter suchen…'}
        onFocus={() => { setIsOpen(true); setQuery('') }}
        onChange={e => setQuery(e.target.value)}
        autoComplete="off"
      />
```

- [ ] **Schritt 2: `CourseCombobox` migrieren**

In `frontend/src/components/CourseCombobox.tsx`:

Import hinzufügen:
```tsx
import { Input } from './ui'
```

Die lokale `inputClass`-Konstante entfernen und den `<input>`-Tag ersetzen. Von:
```tsx
  const inputClass = 'bg-surface-input text-white rounded-lg px-3 py-2 outline-hidden focus:ring-2 focus:ring-brand w-full'
  // ...
      <input
        aria-label="Kursname"
        type="text"
        value={isOpen ? query : value}
        placeholder={isOpen ? '' : (value || 'Kurs suchen…')}
        onFocus={() => { setIsOpen(true); setQuery('') }}
        onChange={e => {
          setQuery(e.target.value)
          onChange(e.target.value)
        }}
        required
        autoComplete="off"
        className={inputClass}
      />
```
zu:
```tsx
      <Input
        aria-label="Kursname"
        type="text"
        value={isOpen ? query : value}
        placeholder={isOpen ? '' : (value || 'Kurs suchen…')}
        onFocus={() => { setIsOpen(true); setQuery('') }}
        onChange={e => {
          setQuery(e.target.value)
          onChange(e.target.value)
        }}
        required
        autoComplete="off"
      />
```

- [ ] **Schritt 3: Build-Check**

```bash
cd frontend && npx tsc --noEmit
```
Erwartetes Ergebnis: keine Fehler

- [ ] **Schritt 4: Committen**

```bash
git add frontend/src/components/FacilityCombobox.tsx frontend/src/components/CourseCombobox.tsx
git commit -m "refactor: migrate Combobox inputs to use ui primitives"
```

---

## Task 11: `UserManagementSection` migrieren

**Files:**
- Modify: `frontend/src/components/UserManagementSection.tsx`

- [ ] **Schritt 1: Baseline prüfen**

```bash
cd frontend && npm test -- UserManagementSection.test
```
Erwartetes Ergebnis: PASS

- [ ] **Schritt 2: Import hinzufügen**

```tsx
import { Button, Input, ModalShell } from './ui'
```

- [ ] **Schritt 3: Filter-Input ersetzen**

Der Filter-Input steht in einem `flex gap-2`-Container neben einem Button — braucht `flex-1`. Von:
```tsx
            <input
              type="text"
              value={emailFilter}
              onChange={e => handleFilterChange(e.target.value)}
              placeholder="Nach E-Mail filtern…"
              className="flex-1 bg-surface-card border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
            />
```
zu:
```tsx
            <div className="flex-1">
              <Input
                variant="filter"
                type="text"
                value={emailFilter}
                onChange={e => handleFilterChange(e.target.value)}
                placeholder="Nach E-Mail filtern…"
              />
            </div>
```

- [ ] **Schritt 4: "Nachricht senden"-Button ersetzen**

Von:
```tsx
                  <button
                    onClick={() => openMessageModal(user)}
                    className="px-3 py-1 rounded-md text-sm font-medium transition-colors bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                    aria-label="Nachricht senden"
                  >
                    ...
                  </button>
```
zu:
```tsx
                  <Button
                    variant="slate"
                    size="sm"
                    aria-label="Nachricht senden"
                    onClick={() => openMessageModal(user)}
                  >
                    <svg className="sm:hidden w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884 10 9.882l7.997-3.998A2 2 0 0 0 16 4H4a2 2 0 0 0-1.997 1.884z"/><path d="m18 8.118-8 4-8-4V14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.118z"/></svg>
                    <span className="hidden sm:inline">Nachricht</span>
                  </Button>
```

- [ ] **Schritt 5: Aktivieren/Deaktivieren-Button ersetzen**

Von:
```tsx
                  <button
                    disabled={isSelf}
                    onClick={() => handleToggle(user)}
                    aria-label={user.active ? 'Deaktivieren' : 'Aktivieren'}
                    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                      isSelf
                        ? 'opacity-40 cursor-not-allowed bg-slate-700 text-slate-400'
                        : user.active
                        ? 'bg-red-900 hover:bg-red-700 text-red-300'
                        : 'bg-green-900 hover:bg-green-700 text-green-300'
                    }`}
                  >
```
zu (der grüne Aktivieren-Button hat keinen passenden Variant — `danger`/`slate` decken nur rot und grau ab; als Ausnahme bleibt nur der aktive State `danger`, der inaktive State bleibt inline):
```tsx
                  {user.active ? (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={isSelf}
                      aria-label="Deaktivieren"
                      onClick={() => handleToggle(user)}
                    >
                      <svg className="sm:hidden w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z" clipRule="evenodd"/>
                      </svg>
                      <span className="hidden sm:inline">Deaktivieren</span>
                    </Button>
                  ) : (
                    <button
                      disabled={isSelf}
                      onClick={() => handleToggle(user)}
                      aria-label="Aktivieren"
                      className="px-3 py-1 rounded-md text-sm font-medium transition-colors bg-green-900 hover:bg-green-700 text-green-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <svg className="sm:hidden w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0z" clipRule="evenodd"/>
                      </svg>
                      <span className="hidden sm:inline">Aktivieren</span>
                    </button>
                  )}
```

- [ ] **Schritt 6: Pagination-Buttons ersetzen**

Von:
```tsx
            <button
              disabled={safePage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="px-3 py-1 rounded-md text-sm bg-surface-card text-slate-400 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-slate-700 transition-colors"
            >
              ← Zurück
            </button>
            <button
              disabled={safePage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="px-3 py-1 rounded-md text-sm bg-surface-card text-slate-400 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-slate-700 transition-colors"
            >
              Weiter →
            </button>
```
zu:
```tsx
            <Button variant="secondary" size="sm" disabled={safePage === 1} onClick={() => setCurrentPage(p => p - 1)}>
              ← Zurück
            </Button>
            <Button variant="secondary" size="sm" disabled={safePage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              Weiter →
            </Button>
```

- [ ] **Schritt 7: `pendingLimit`-Dialog migrieren**

Von:
```tsx
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-card border border-slate-700 rounded-xl p-6 max-w-sm w-full mx-4">
```
zu:
```tsx
        <ModalShell maxWidth="sm">
```
und schließendes `</div></div>` durch `</ModalShell>`.

Buttons in diesem Dialog ersetzen:
```tsx
              <Button variant="ghost" onClick={() => setPendingLimit(null)}>
                Abbrechen
              </Button>
              <Button variant="danger" onClick={handleConfirmLimit}>
                Ja, Limit setzen
              </Button>
```

- [ ] **Schritt 8: `messagingUser`-Dialog migrieren**

Von:
```tsx
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-card border border-slate-700 rounded-xl p-6 max-w-sm w-full mx-4">
```
zu:
```tsx
        <ModalShell maxWidth="sm">
```

Inputs und Buttons ersetzen:
- "Betreff"-Input: `<Input variant="filter" type="text" value={messageSubject} onChange={e => setMessageSubject(e.target.value)} placeholder="Betreff" />`
- "Nachricht"-Textarea: bleibt inline (`<textarea>` kein `<input>`)
- "Senden"-Button: `<Button variant="primary" loading={messageSending} disabled={!messageSubject.trim() || !messageContent.trim()} onClick={handleSendMessage}>Senden</Button>`
- "Abbrechen"-Button: `<Button variant="ghost" disabled={messageSending} onClick={closeMessageModal}>Abbrechen</Button>`
- "Schließen"-Button (nach Senden): `<Button variant="primary" onClick={closeMessageModal}>Schließen</Button>`

- [ ] **Schritt 9: Tests ausführen**

```bash
cd frontend && npm test -- UserManagementSection.test
```
Erwartetes Ergebnis: alle Tests PASS

- [ ] **Schritt 10: Committen**

```bash
git add frontend/src/components/UserManagementSection.tsx
git commit -m "refactor: migrate UserManagementSection to use ui primitives"
```

---

## Task 12: `AllJobsSection` migrieren

**Files:**
- Modify: `frontend/src/components/AllJobsSection.tsx`

- [ ] **Schritt 1: Baseline prüfen**

```bash
cd frontend && npm test -- AllJobsSection.test
```
Erwartetes Ergebnis: PASS

- [ ] **Schritt 2: Import + Filter-Input**

Import:
```tsx
import { Button, Input } from './ui'
```

Filter-Input (steht allein in `flex-col`-Container, `flex-1` hat hier keine Wirkung — `w-full` aus Input reicht):
Von:
```tsx
          <input
            type="text"
            value={emailFilter}
            onChange={e => handleFilterChange(e.target.value)}
            placeholder="Nach E-Mail filtern…"
            className="flex-1 bg-surface-card border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
          />
```
zu:
```tsx
          <Input
            variant="filter"
            type="text"
            value={emailFilter}
            onChange={e => handleFilterChange(e.target.value)}
            placeholder="Nach E-Mail filtern…"
          />
```

- [ ] **Schritt 3: Pagination-Buttons ersetzen**

Analog zu UserManagementSection:
```tsx
            <Button variant="secondary" size="sm" disabled={safePage === 1} onClick={() => setCurrentPage(p => p - 1)}>
              ← Zurück
            </Button>
            <Button variant="secondary" size="sm" disabled={safePage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              Weiter →
            </Button>
```

- [ ] **Schritt 4: Tests ausführen**

```bash
cd frontend && npm test -- AllJobsSection.test
```
Erwartetes Ergebnis: PASS

- [ ] **Schritt 5: Committen**

```bash
git add frontend/src/components/AllJobsSection.tsx
git commit -m "refactor: migrate AllJobsSection to use ui primitives"
```

---

## Task 13: `AllLogsSection` migrieren

**Files:**
- Modify: `frontend/src/components/AllLogsSection.tsx`

- [ ] **Schritt 1: Baseline prüfen**

```bash
cd frontend && npm test -- AllLogsSection.test
```
Erwartetes Ergebnis: PASS

- [ ] **Schritt 2: Import + Filter-Input + Pagination**

Import:
```tsx
import { Button, Input, ModalShell } from './ui'
```

Filter-Input (analog AllJobsSection):
```tsx
          <Input
            variant="filter"
            type="text"
            value={emailFilter}
            onChange={e => setEmailFilter(e.target.value)}
            placeholder="Nach E-Mail filtern…"
          />
```

Pagination (analog):
```tsx
            <Button variant="secondary" size="sm" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
              ← Zurück
            </Button>
            <Button variant="secondary" size="sm" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              Weiter →
            </Button>
```

- [ ] **Schritt 3: `expandedMessage`-Dialog migrieren**

Dieser Dialog nutzt `z-50` und `max-w-lg`. Da ModalShell nur `max-w-md` unterstützt und `max-w-lg` für längere Fehlermeldungen wichtig ist, bleibt die äußere Struktur inline. Nur der "Schließen"-Button wird ersetzt:

Von:
```tsx
              <button
                onClick={() => setExpandedMessage(null)}
                className="mt-3 text-slate-400 text-sm hover:text-white"
              >
                Schließen
              </button>
```
zu:
```tsx
              <div className="mt-3">
                <Button variant="ghost" onClick={() => setExpandedMessage(null)}>
                  Schließen
                </Button>
              </div>
```

- [ ] **Schritt 4: Tests ausführen**

```bash
cd frontend && npm test -- AllLogsSection.test
```
Erwartetes Ergebnis: PASS

- [ ] **Schritt 5: Committen**

```bash
git add frontend/src/components/AllLogsSection.tsx
git commit -m "refactor: migrate AllLogsSection to use ui primitives"
```

---

## Task 14: `TestEmailModal` migrieren

**Files:**
- Modify: `frontend/src/components/TestEmailModal.tsx`

- [ ] **Schritt 1: Baseline prüfen**

```bash
cd frontend && npm test -- TestEmailModal.test
```
Erwartetes Ergebnis: PASS

- [ ] **Schritt 2: Import + ModalShell**

Import:
```tsx
import { ModalShell } from './ui'
```

Äußeren Wrapper ersetzen (die Action-Buttons für E-Mail-Typen behalten ihre `w-full text-left py-3`-Styles — sie sind keine Standard-Actions sondern Listen-Items):
Von:
```tsx
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-surface-card rounded-xl w-full max-w-md p-6">
```
zu:
```tsx
    <ModalShell>
```
und schließendes `</div></div>` durch `</ModalShell>`.

- [ ] **Schritt 3: Tests ausführen**

```bash
cd frontend && npm test -- TestEmailModal.test
```
Erwartetes Ergebnis: PASS

- [ ] **Schritt 4: Committen**

```bash
git add frontend/src/components/TestEmailModal.tsx
git commit -m "refactor: migrate TestEmailModal to use ui primitives"
```

---

## Task 15: Abschluss-Verifikation

- [ ] **Schritt 1: Alle Tests ausführen**

```bash
cd frontend && npm test
```
Erwartetes Ergebnis: alle Tests PASS (kein einziger Fehler)

- [ ] **Schritt 2: TypeScript-Build**

```bash
cd frontend && npm run build
```
Erwartetes Ergebnis: Build erfolgreich, keine TypeScript-Fehler, keine Vite-Warnungen (abgesehen vom bekannten `<script src="/config.js">` Hinweis)

- [ ] **Schritt 3: Abschluss-Commit** (falls noch nicht committed)

```bash
git add -p
git commit -m "refactor: complete ui primitives migration"
```
