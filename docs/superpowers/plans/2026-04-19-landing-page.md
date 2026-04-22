# Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Zeige unangemeldeten Benutzern eine Landing Page mit Hero, Video und zwei Screenshots; das Login-Formular öffnet sich als Modal.

**Architecture:** `LoginPage` wird aufgelöst — die Login-Logik zieht in `LoginModal`. Eine neue `LandingPage` baut die öffentliche Seite auf und verwaltet den Modal-State. `App.tsx` bekommt angepasste Routen: `/` → LandingPage (öffentlich), `/dashboard` → RequireAuth (Redirect zu `/`).

**Tech Stack:** React 19, TypeScript, React Router v6, Tailwind CSS v4, Vitest + Testing Library

---

## Datei-Übersicht

| Aktion | Datei | Verantwortung |
|--------|-------|---------------|
| Neu | `frontend/src/components/LoginModal.tsx` | Login-Formular als Modal (Email, Passwort, Fehler, Loading) |
| Neu | `frontend/src/components/LoginModal.test.tsx` | Tests für LoginModal |
| Neu | `frontend/src/pages/LandingPage.tsx` | Landing Page mit allen Sektionen |
| Neu | `frontend/src/pages/LandingPage.test.tsx` | Tests für LandingPage |
| Ändern | `frontend/src/App.tsx` | Routing anpassen |
| Löschen | `frontend/src/pages/LoginPage.tsx` | Ersetzt durch LoginModal |
| Löschen | `frontend/src/pages/LoginPage.test.tsx` | Nicht mehr relevant |

---

### Task 1: LoginModal-Komponente

**Files:**
- Create: `frontend/src/components/LoginModal.tsx`
- Create: `frontend/src/components/LoginModal.test.tsx`

- [ ] **Schritt 1: Failing-Test schreiben**

Datei `frontend/src/components/LoginModal.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import LoginModal from './LoginModal'
import * as authApi from '../api/auth'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('LoginModal', () => {
  it('renders email and password fields', () => {
    render(<MemoryRouter><LoginModal onClose={vi.fn()} /></MemoryRouter>)
    expect(screen.getByPlaceholderText(/e-mail/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/passwort/i)).toBeInTheDocument()
  })

  it('calls login, navigates and closes on success', async () => {
    const onClose = vi.fn()
    vi.spyOn(authApi, 'login').mockResolvedValue(undefined)
    render(<MemoryRouter><LoginModal onClose={onClose} /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText(/e-mail/i), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByPlaceholderText(/passwort/i), { target: { value: 'pass' } })
    fireEvent.click(screen.getByRole('button', { name: /anmelden/i }))
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('shows error message on failed login', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValue(new Error('Invalid credentials'))
    render(<MemoryRouter><LoginModal onClose={vi.fn()} /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText(/e-mail/i), { target: { value: 'bad@b.com' } })
    fireEvent.change(screen.getByPlaceholderText(/passwort/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /anmelden/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<MemoryRouter><LoginModal onClose={onClose} /></MemoryRouter>)
    fireEvent.click(screen.getByTestId('login-modal-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn()
    render(<MemoryRouter><LoginModal onClose={onClose} /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /schließen/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
```

- [ ] **Schritt 2: Test laufen lassen — muss scheitern**

```bash
cd frontend && npx vitest run src/components/LoginModal.test.tsx
```

Erwartetes Ergebnis: FAIL mit „Cannot find module './LoginModal'"

- [ ] **Schritt 3: LoginModal implementieren**

Datei `frontend/src/components/LoginModal.tsx`:

```tsx
import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/auth'

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
      navigate('/dashboard')
      onClose()
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60"
      data-testid="login-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative bg-surface-card rounded-xl p-8 flex flex-col gap-4">
          <button
            type="button"
            aria-label="Schließen"
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>

          <div className="flex justify-center mb-2">
            <img src="/logo.png" alt="Logo" className="h-12 w-auto" />
          </div>

          <p className="text-slate-400 text-sm text-center">
            Nutze deine Eversports Anmeldedaten, um fortzufahren.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <input
              type="email"
              placeholder="E-Mail"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              className="bg-surface-input text-white rounded-lg px-4 py-3 outline-hidden focus:ring-2 focus:ring-brand [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_var(--color-surface-input)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:white]"
            />
            <input
              type="password"
              placeholder="Passwort"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              className="bg-surface-input text-white rounded-lg px-4 py-3 outline-hidden focus:ring-2 focus:ring-brand [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_var(--color-surface-input)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:white]"
            />
            {error && (
              <p role="alert" className="text-red-400 text-sm">{error}</p>
            )}
            <button
              type="submit"
              disabled={loading}
              className="bg-brand hover:bg-brand-hover disabled:opacity-50 text-white font-semibold rounded-lg py-3 transition-colors"
            >
              {loading ? 'Anmelden…' : 'Anmelden'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Schritt 4: Tests laufen lassen — müssen bestehen**

```bash
cd frontend && npx vitest run src/components/LoginModal.test.tsx
```

Erwartetes Ergebnis: 5 Tests PASS

- [ ] **Schritt 5: Commit**

```bash
cd frontend && git add src/components/LoginModal.tsx src/components/LoginModal.test.tsx
git commit -m "feat: add LoginModal component extracted from LoginPage"
```

---

### Task 2: LandingPage

**Files:**
- Create: `frontend/src/pages/LandingPage.tsx`
- Create: `frontend/src/pages/LandingPage.test.tsx`

- [ ] **Schritt 1: Failing-Test schreiben**

Datei `frontend/src/pages/LandingPage.test.tsx`:

```tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import LandingPage from './LandingPage'

vi.mock('../components/LoginModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="login-modal">
      <button onClick={onClose}>Schließen</button>
    </div>
  ),
}))

describe('LandingPage', () => {
  it('renders hero headline', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    expect(screen.getByText(/nie wieder/i)).toBeInTheDocument()
  })

  it('renders logo in navbar', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    expect(screen.getByAltText(/logo/i)).toBeInTheDocument()
  })

  it('renders Anmelden button in navbar', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    expect(screen.getAllByRole('button', { name: /anmelden/i }).length).toBeGreaterThan(0)
  })

  it('opens login modal when Anmelden is clicked', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    fireEvent.click(screen.getAllByRole('button', { name: /anmelden/i })[0])
    expect(screen.getByTestId('login-modal')).toBeInTheDocument()
  })

  it('closes login modal when onClose is called', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    fireEvent.click(screen.getAllByRole('button', { name: /anmelden/i })[0])
    fireEvent.click(screen.getByRole('button', { name: /schließen/i }))
    expect(screen.queryByTestId('login-modal')).not.toBeInTheDocument()
  })

  it('renders video section label', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    expect(screen.getByText(/so funktioniert/i)).toBeInTheDocument()
  })

  it('renders screenshot 2 section label', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    expect(screen.getByText(/übersicht behalten/i)).toBeInTheDocument()
  })
})
```

- [ ] **Schritt 2: Test laufen lassen — muss scheitern**

```bash
cd frontend && npx vitest run src/pages/LandingPage.test.tsx
```

Erwartetes Ergebnis: FAIL mit „Cannot find module './LandingPage'"

- [ ] **Schritt 3: LandingPage implementieren**

Datei `frontend/src/pages/LandingPage.tsx`:

```tsx
import { useState } from 'react'
import LoginModal from '../components/LoginModal'

export default function LandingPage() {
  const [modalOpen, setModalOpen] = useState(false)

  function openModal() { setModalOpen(true) }
  function closeModal() { setModalOpen(false) }

  return (
    <div className="min-h-screen bg-surface-page">

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-20 bg-surface-page border-b border-slate-700/60">
        <div className="px-4 max-w-5xl mx-auto flex justify-between items-center py-4">
          <img src="/logo.png" alt="Logo" className="h-10 w-auto sm:h-14" />
          <button
            onClick={openModal}
            className="bg-brand hover:bg-brand-hover text-white font-semibold rounded-lg px-5 py-2 transition-colors"
          >
            Anmelden
          </button>
        </div>
      </nav>

      <div className="pt-20 sm:pt-24">

        {/* Hero */}
        <section className="max-w-5xl mx-auto px-4 py-16 flex flex-col sm:flex-row items-center gap-10">
          <div className="flex-1">
            <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-4">
              Nie wieder<br />
              <span className="text-brand-hover">Buchung verpassen.</span>
            </h1>
            <p className="text-slate-400 text-base leading-relaxed mb-8">
              Richte deine Eversports-Buchungen einmal ein – die App bucht
              automatisch jede Woche zur richtigen Zeit.
            </p>
            <button
              onClick={openModal}
              className="bg-brand hover:bg-brand-hover text-white font-semibold rounded-xl px-6 py-3 transition-colors"
            >
              Jetzt anmelden →
            </button>
          </div>

          {/* Screenshot 1 Platzhalter */}
          <div className="flex-shrink-0 w-full sm:w-72 h-48 bg-surface-card border border-slate-700/60 rounded-xl flex flex-col items-center justify-center text-slate-600 gap-2">
            <span className="text-3xl">📷</span>
            <span className="text-sm">Screenshot 1</span>
          </div>
        </section>

        <hr className="border-slate-700/60 max-w-5xl mx-auto" />

        {/* Video-Sektion */}
        <section className="max-w-5xl mx-auto px-4 py-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-hover mb-2">
            So funktioniert's
          </p>
          <h2 className="text-2xl font-bold text-white mb-2">
            Einmal einrichten, jede Woche profitieren
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-6 max-w-xl">
            Wähle Kurs, Uhrzeit und Wochentag – die App erledigt den Rest vollautomatisch.
          </p>

          {/* Video Platzhalter */}
          <div className="w-full h-56 sm:h-72 bg-surface-card border border-slate-700/60 rounded-xl flex flex-col items-center justify-center text-slate-600 gap-3">
            <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center text-white text-lg">
              ▶
            </div>
            <span className="text-sm">Video-Platzhalter</span>
          </div>
        </section>

        <hr className="border-slate-700/60 max-w-5xl mx-auto" />

        {/* Screenshot 2 */}
        <section className="max-w-5xl mx-auto px-4 py-14 flex flex-col sm:flex-row items-center gap-10">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-hover mb-2">
              Übersicht behalten
            </p>
            <h2 className="text-2xl font-bold text-white mb-2">
              Alle Buchungen auf einen Blick
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Sieh alle geplanten Buchungen, aktiviere oder pausiere sie
              jederzeit – direkt in der App.
            </p>
          </div>

          {/* Screenshot 2 Platzhalter */}
          <div className="flex-shrink-0 w-full sm:w-72 h-44 bg-surface-card border border-slate-700/60 rounded-xl flex flex-col items-center justify-center text-slate-600 gap-2">
            <span className="text-3xl">📷</span>
            <span className="text-sm">Screenshot 2</span>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="bg-surface-card border-t border-slate-700/60 text-center py-14 px-4">
          <h2 className="text-2xl font-bold text-white mb-2">Bereit loszulegen?</h2>
          <p className="text-slate-400 text-sm mb-6">Melde dich mit deinen Eversports-Daten an.</p>
          <button
            onClick={openModal}
            className="bg-brand hover:bg-brand-hover text-white font-semibold rounded-xl px-8 py-3 transition-colors"
          >
            Anmelden
          </button>
        </section>

      </div>

      {/* Login Modal */}
      {modalOpen && <LoginModal onClose={closeModal} />}
    </div>
  )
}
```

- [ ] **Schritt 4: Tests laufen lassen — müssen bestehen**

```bash
cd frontend && npx vitest run src/pages/LandingPage.test.tsx
```

Erwartetes Ergebnis: 7 Tests PASS

- [ ] **Schritt 5: Commit**

```bash
cd frontend && git add src/pages/LandingPage.tsx src/pages/LandingPage.test.tsx
git commit -m "feat: add LandingPage with hero, video and screenshot sections"
```

---

### Task 3: Routing in App.tsx anpassen

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Schritt 1: App.tsx ersetzen**

```tsx
import type { ReactElement } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/DashboardPage'
import Footer from './components/Footer'

function RequireAuth({ children }: { children: ReactElement }) {
  const token = localStorage.getItem('token')
  return token ? children : <Navigate to="/" replace />
}

export default function App() {
  return (
    <BrowserRouter>
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

- [ ] **Schritt 2: Alle Tests laufen lassen**

```bash
cd frontend && npx vitest run
```

Erwartetes Ergebnis: Alle bisherigen Tests bestehen (LoginPage-Tests schlagen erwartungsgemäß noch nicht fehl, weil die Datei noch existiert)

- [ ] **Schritt 3: Commit**

```bash
cd frontend && git add src/App.tsx
git commit -m "feat: update routing to use LandingPage as public entry point"
```

---

### Task 4: LoginPage entfernen

**Files:**
- Delete: `frontend/src/pages/LoginPage.tsx`
- Delete: `frontend/src/pages/LoginPage.test.tsx`

- [ ] **Schritt 1: Dateien löschen**

```bash
cd frontend && rm src/pages/LoginPage.tsx src/pages/LoginPage.test.tsx
```

- [ ] **Schritt 2: Alle Tests laufen lassen**

```bash
cd frontend && npx vitest run
```

Erwartetes Ergebnis: Alle Tests PASS — keine Referenz auf LoginPage mehr

- [ ] **Schritt 3: TypeScript-Build prüfen**

```bash
cd frontend && npx tsc -b --noEmit
```

Erwartetes Ergebnis: Keine Fehler

- [ ] **Schritt 4: Commit**

```bash
cd frontend && git add -A
git commit -m "feat: remove LoginPage, login is now handled via LoginModal on LandingPage"
```

---

## Definition of Done

- [ ] `npx vitest run` — alle Tests grün
- [ ] `npx tsc -b --noEmit` — keine TypeScript-Fehler
- [ ] Unangemeldete Benutzer sehen die Landing Page auf `/`
- [ ] Klick auf jeden „Anmelden"-Button öffnet das Login-Modal
- [ ] Erfolgreicher Login navigiert zu `/dashboard`
- [ ] Direktaufruf von `/dashboard` ohne Token redirectet zu `/`
