# Stripe Checkout Button (Admin) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admin-only "Abo kaufen"-Button im SettingsModal, der Abo-Status von `GET /api/me` liest und bei Klick zu Stripe Checkout weiterleitet.

**Architecture:** `MeResponse`-Schema bekommt `email`, `role`, `subscription_active`; `get_me()`-Endpunkt berechnet `subscription_active` aus `max_active_jobs is None`. Neues `frontend/src/api/stripe.ts` mit getippten Wrappern. `SettingsModal.tsx` holt Abo-Status beim Mounten (nur für Admins) und rendert Button-Sektion oberhalb der Konto-löschen-Sektion.

**Tech Stack:** FastAPI + Pydantic v2 (Python), React + TypeScript, Vitest + @testing-library/react

---

## Dateiübersicht

| Datei | Aktion |
|---|---|
| `backend/schemas/user.py` | `MeResponse` ersetzen: `email`, `role`, `subscription_active` |
| `backend/api/account.py` | `get_me()` explizit `MeResponse` konstruieren |
| `tests/backend/test_api_account.py` | Drei neue Tests für `GET /api/me` |
| `frontend/src/api/stripe.ts` | Neu: `getMe()` + `createCheckoutSession()` |
| `frontend/src/components/SettingsModal.tsx` | Admin-Abo-Sektion + Checkout-Button |
| `frontend/src/components/SettingsModal.test.tsx` | Neue Tests für Abo-Sektion |

---

### Task 1: MeResponse-Schema und GET /api/me Endpunkt aktualisieren

**Files:**
- Modify: `backend/schemas/user.py`
- Modify: `backend/api/account.py`
- Test: `tests/backend/test_api_account.py`

- [ ] **Step 1: Fehlschlagende Tests schreiben**

In `tests/backend/test_api_account.py` am Ende anfügen:

```python
def test_get_me_without_subscription(client, db_session):
    user = _create_active_user(db_session)
    user.max_active_jobs = 1
    db_session.commit()
    resp = client.get("/api/me", headers=_auth_header(user.id))
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "user@example.com"
    assert data["role"] == "user"
    assert data["subscription_active"] is False


def test_get_me_with_subscription(client, db_session):
    user = _create_active_user(db_session)
    user.max_active_jobs = None
    db_session.commit()
    resp = client.get("/api/me", headers=_auth_header(user.id))
    assert resp.status_code == 200
    data = resp.json()
    assert data["subscription_active"] is True


def test_get_me_without_token_returns_401(client):
    resp = client.get("/api/me")
    assert resp.status_code == 401
```

- [ ] **Step 2: Test fehlschlagen lassen**

```bash
pytest tests/backend/test_api_account.py::test_get_me_without_subscription -v
```

Erwartetes Ergebnis: FAIL (Antwort enthält `subscription_active` nicht)

- [ ] **Step 3: MeResponse-Schema ersetzen**

In `backend/schemas/user.py` den bestehenden `MeResponse`-Block ersetzen:

```python
class MeResponse(BaseModel):
    email: str
    role: str
    subscription_active: bool
```

`model_config` entfällt — `MeResponse` wird manuell konstruiert, nicht über `from_attributes`.

- [ ] **Step 4: get_me()-Endpunkt anpassen**

In `backend/api/account.py` die `get_me()`-Funktion ersetzen:

```python
@router.get("/me", response_model=MeResponse)
def get_me(current_user: User = Depends(get_current_active_user)):
    return MeResponse(
        email=current_user.email,
        role=current_user.role,
        subscription_active=current_user.max_active_jobs is None,
    )
```

- [ ] **Step 5: Alle Tests laufen lassen**

```bash
pytest tests/backend/test_api_account.py -v
```

Erwartetes Ergebnis: Alle Tests PASS (inkl. bestehende DELETE-Tests)

- [ ] **Step 6: Commit**

```bash
git add backend/schemas/user.py backend/api/account.py tests/backend/test_api_account.py
git commit -m "feat: update MeResponse with subscription_active field"
```

---

### Task 2: Frontend-API-Modul erstellen

**Files:**
- Create: `frontend/src/api/stripe.ts`

- [ ] **Step 1: Datei erstellen**

`frontend/src/api/stripe.ts` anlegen:

```typescript
import { apiFetch } from './client'

export interface MeResponse {
  email: string
  role: string
  subscription_active: boolean
}

export const getMe = (): Promise<MeResponse> =>
  apiFetch('/api/me')

export const createCheckoutSession = (): Promise<{ url: string }> =>
  apiFetch('/api/stripe/checkout', { method: 'POST' })
```

- [ ] **Step 2: TypeScript prüfen**

```bash
cd frontend && npx tsc --noEmit
```

Erwartetes Ergebnis: Keine Fehler

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/stripe.ts
git commit -m "feat: add stripe API module with getMe and createCheckoutSession"
```

---

### Task 3: SettingsModal mit Abo-Sektion erweitern

**Files:**
- Modify: `frontend/src/components/SettingsModal.tsx`
- Modify: `frontend/src/components/SettingsModal.test.tsx`

- [ ] **Step 1: Fehlschlagende Tests schreiben**

`frontend/src/components/SettingsModal.test.tsx` vollständig ersetzen:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/account', () => ({
  deleteAccount: vi.fn(),
}))
vi.mock('../api/client', () => ({
  clearToken: vi.fn(),
  isActualAdmin: vi.fn(),
}))
vi.mock('../api/stripe', () => ({
  getMe: vi.fn(),
  createCheckoutSession: vi.fn(),
}))

import SettingsModal from './SettingsModal'
import { deleteAccount } from '../api/account'
import { clearToken, isActualAdmin } from '../api/client'
import { getMe, createCheckoutSession } from '../api/stripe'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderModal(onClose = vi.fn()) {
  return render(
    <MemoryRouter>
      <SettingsModal onClose={onClose} />
    </MemoryRouter>
  )
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('SettingsModal', () => {
  it('renders the settings heading and delete section', () => {
    vi.mocked(isActualAdmin).mockReturnValue(false)
    renderModal()
    expect(screen.getByRole('heading', { name: 'Einstellungen' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Konto löschen' })).toBeInTheDocument()
  })

  it('shows the irreversibility warning', () => {
    vi.mocked(isActualAdmin).mockReturnValue(false)
    renderModal()
    expect(screen.getByText(/unwiderruflich/i)).toBeInTheDocument()
  })

  it('delete button is disabled when input is empty', () => {
    vi.mocked(isActualAdmin).mockReturnValue(false)
    renderModal()
    const btn = screen.getByRole('button', { name: /konto löschen/i })
    expect(btn).toBeDisabled()
  })

  it('delete button is disabled when input is wrong', () => {
    vi.mocked(isActualAdmin).mockReturnValue(false)
    renderModal()
    fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'delete' } })
    expect(screen.getByRole('button', { name: /konto löschen/i })).toBeDisabled()
  })

  it('delete button is enabled when DELETE is typed exactly', () => {
    vi.mocked(isActualAdmin).mockReturnValue(false)
    renderModal()
    fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } })
    expect(screen.getByRole('button', { name: /konto löschen/i })).not.toBeDisabled()
  })

  it('calls deleteAccount, clearToken, and navigates to / on success', async () => {
    vi.mocked(isActualAdmin).mockReturnValue(false)
    vi.mocked(deleteAccount).mockResolvedValue(undefined)
    renderModal()
    fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } })
    fireEvent.click(screen.getByRole('button', { name: /konto löschen/i }))
    await waitFor(() => {
      expect(deleteAccount).toHaveBeenCalledOnce()
      expect(clearToken).toHaveBeenCalledOnce()
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  it('shows error message when deleteAccount fails', async () => {
    vi.mocked(isActualAdmin).mockReturnValue(false)
    vi.mocked(deleteAccount).mockRejectedValue(new Error('Serverfehler'))
    renderModal()
    fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } })
    fireEvent.click(screen.getByRole('button', { name: /konto löschen/i }))
    expect(await screen.findByText('Serverfehler')).toBeInTheDocument()
    expect(clearToken).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('calls onClose when the X button is clicked', () => {
    vi.mocked(isActualAdmin).mockReturnValue(false)
    const onClose = vi.fn()
    renderModal(onClose)
    fireEvent.click(screen.getByLabelText('Schließen'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})

describe('SettingsModal — Abo-Sektion', () => {
  it('zeigt keine Abo-Sektion für Nicht-Admins', () => {
    vi.mocked(isActualAdmin).mockReturnValue(false)
    renderModal()
    expect(screen.queryByRole('heading', { name: 'Abonnement' })).not.toBeInTheDocument()
  })

  it('zeigt Abo-Sektion für Admins', async () => {
    vi.mocked(isActualAdmin).mockReturnValue(true)
    vi.mocked(getMe).mockResolvedValue({ email: 'admin@example.com', role: 'admin', subscription_active: false })
    renderModal()
    expect(await screen.findByRole('heading', { name: 'Abonnement' })).toBeInTheDocument()
  })

  it('Button deaktiviert wenn Abo aktiv', async () => {
    vi.mocked(isActualAdmin).mockReturnValue(true)
    vi.mocked(getMe).mockResolvedValue({ email: 'admin@example.com', role: 'admin', subscription_active: true })
    renderModal()
    const btn = await screen.findByRole('button', { name: /abo bereits aktiv/i })
    expect(btn).toBeDisabled()
  })

  it('Button aktiv wenn kein Abo', async () => {
    vi.mocked(isActualAdmin).mockReturnValue(true)
    vi.mocked(getMe).mockResolvedValue({ email: 'admin@example.com', role: 'admin', subscription_active: false })
    renderModal()
    const btn = await screen.findByRole('button', { name: /abo kaufen/i })
    expect(btn).not.toBeDisabled()
  })

  it('Button aktiv wenn getMe fehlschlägt (Fallback)', async () => {
    vi.mocked(isActualAdmin).mockReturnValue(true)
    vi.mocked(getMe).mockRejectedValue(new Error('Netzwerkfehler'))
    renderModal()
    const btn = await screen.findByRole('button', { name: /abo kaufen/i })
    expect(btn).not.toBeDisabled()
  })

  it('leitet nach Checkout-URL weiter', async () => {
    vi.mocked(isActualAdmin).mockReturnValue(true)
    vi.mocked(getMe).mockResolvedValue({ email: 'admin@example.com', role: 'admin', subscription_active: false })
    vi.mocked(createCheckoutSession).mockResolvedValue({ url: 'https://checkout.stripe.com/pay/test' })
    delete (window as any).location
    ;(window as any).location = { href: '' }
    renderModal()
    const btn = await screen.findByRole('button', { name: /abo kaufen/i })
    fireEvent.click(btn)
    await waitFor(() => {
      expect(window.location.href).toBe('https://checkout.stripe.com/pay/test')
    })
  })

  it('zeigt Fehlermeldung bei Checkout-Fehler', async () => {
    vi.mocked(isActualAdmin).mockReturnValue(true)
    vi.mocked(getMe).mockResolvedValue({ email: 'admin@example.com', role: 'admin', subscription_active: false })
    vi.mocked(createCheckoutSession).mockRejectedValue(new Error('Stripe nicht erreichbar'))
    renderModal()
    const btn = await screen.findByRole('button', { name: /abo kaufen/i })
    fireEvent.click(btn)
    expect(await screen.findByText('Stripe nicht erreichbar')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /abo kaufen/i })).not.toBeDisabled()
  })
})
```

- [ ] **Step 2: Tests fehlschlagen lassen**

```bash
cd frontend && npm test -- --run SettingsModal
```

Erwartetes Ergebnis: Neue Tests FAIL (Modul `../api/stripe` nicht gefunden, Elemente nicht im DOM)

- [ ] **Step 3: SettingsModal.tsx erweitern**

`frontend/src/components/SettingsModal.tsx` vollständig ersetzen:

```typescript
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearToken, isActualAdmin } from '../api/client'
import { deleteAccount } from '../api/account'
import { getMe, createCheckoutSession } from '../api/stripe'

interface Props {
  onClose: () => void
}

export default function SettingsModal({ onClose }: Props) {
  const navigate = useNavigate()
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subscriptionActive, setSubscriptionActive] = useState<boolean | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  useEffect(() => {
    if (!isActualAdmin()) return
    getMe()
      .then(data => setSubscriptionActive(data.subscription_active))
      .catch(() => setSubscriptionActive(false))
  }, [])

  async function handleDelete() {
    setLoading(true)
    setError(null)
    try {
      await deleteAccount()
      clearToken()
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen des Kontos.')
      setLoading(false)
    }
  }

  async function handleCheckout() {
    setCheckoutLoading(true)
    setCheckoutError(null)
    try {
      const data = await createCheckoutSession()
      window.location.href = data.url
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Fehler beim Starten des Checkouts.')
      setCheckoutLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-surface-card rounded-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-white font-bold text-lg">Einstellungen</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-xl leading-none"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        {isActualAdmin() && (
          <div className="border-t border-slate-700 pt-5 mb-5">
            <h3 className="text-white font-semibold mb-3">Abonnement</h3>
            <button
              onClick={handleCheckout}
              disabled={subscriptionActive === true || checkoutLoading}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {checkoutLoading
                ? 'Wird vorbereitet…'
                : subscriptionActive
                ? 'Abo bereits aktiv'
                : 'Abo kaufen'}
            </button>
            {checkoutError && <p className="text-red-400 text-sm mt-2">{checkoutError}</p>}
          </div>
        )}

        <div className="border-t border-slate-700 pt-5">
          <h3 className="text-white font-semibold mb-2">Konto löschen</h3>
          <p className="text-red-400 text-sm mb-4">
            Diese Aktion ist unwiderruflich. Dein Konto bei FOReversports und alle geplanten Buchungen werden dauerhaft gelöscht.
          </p>

          <label className="flex flex-col gap-1 mb-4">
            <span className="text-slate-400 text-sm">
              Zur Bestätigung <span className="font-mono text-slate-200">DELETE</span> eingeben
            </span>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="bg-surface-input text-white rounded-lg px-3 py-2 outline-hidden focus:ring-2 focus:ring-red-500 font-mono"
            />
          </label>

          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

          <button
            onClick={handleDelete}
            disabled={confirmText !== 'DELETE' || loading}
            className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Wird gelöscht…' : 'Konto löschen'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Tests laufen lassen**

```bash
cd frontend && npm test -- --run SettingsModal
```

Erwartetes Ergebnis: Alle 16 Tests PASS

- [ ] **Step 5: TypeScript prüfen**

```bash
cd frontend && npx tsc --noEmit
```

Erwartetes Ergebnis: Keine Fehler

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/SettingsModal.tsx frontend/src/components/SettingsModal.test.tsx
git commit -m "feat: add admin subscription section with Abo kaufen button to SettingsModal"
```
