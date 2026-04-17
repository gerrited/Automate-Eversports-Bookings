# User Management Filter & Pagination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** E-Mail-Filterung (live ab 3 Zeichen) und Seiten-Paginierung (25 User pro Seite, Vor/Zurück) in der Benutzerverwaltung.

**Architecture:** Rein client-seitig — alle User werden einmalig geladen, Filter und Paginierung passieren per abgeleiteten Werten im Frontend. Kein Backend-Aufwand.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Vitest + React Testing Library

---

## File Map

| Datei | Aktion |
|-------|--------|
| `frontend/src/components/UserManagementSection.tsx` | Modify: Filter-Input, abgeleitete Werte, Paginierungssteuerung |
| `frontend/src/components/UserManagementSection.test.tsx` | Create: Tests für Filter und Paginierung |

---

### Task 1: Tests schreiben (failing)

**Files:**
- Create: `frontend/src/components/UserManagementSection.test.tsx`

- [ ] **Step 1: Testdatei anlegen**

```tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import UserManagementSection from './UserManagementSection'

// Mock der API-Module
vi.mock('../api/users', () => ({
  listUsers: vi.fn(),
  setUserActive: vi.fn(),
}))
vi.mock('../api/client', () => ({
  getEmail: () => 'me@test.de',
}))

import { listUsers } from '../api/users'

function makeUsers(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `user-${i}`,
    email: `user${i}@example.com`,
    active: true,
    role: 'user',
    job_count: i,
    created_at: '2026-01-01T00:00:00Z',
  }))
}

beforeEach(() => {
  vi.mocked(listUsers).mockResolvedValue(makeUsers(60))
})

describe('UserManagementSection', () => {
  it('zeigt ein Filterfeld an', async () => {
    render(<UserManagementSection />)
    expect(await screen.findByPlaceholderText('Nach E-Mail filtern…')).toBeInTheDocument()
  })

  it('zeigt ohne Filter maximal 25 User an (Seite 1)', async () => {
    render(<UserManagementSection />)
    await screen.findByPlaceholderText('Nach E-Mail filtern…')
    // 60 User geladen, nur 25 auf Seite 1 sichtbar
    expect(screen.getAllByText(/user\d+@example\.com/).length).toBe(25)
  })

  it('filter mit < 3 Zeichen ändert nichts', async () => {
    render(<UserManagementSection />)
    const input = await screen.findByPlaceholderText('Nach E-Mail filtern…')
    fireEvent.change(input, { target: { value: 'us' } })
    expect(screen.getAllByText(/user\d+@example\.com/).length).toBe(25)
  })

  it('filter mit 3+ Zeichen begrenzt Ergebnisse', async () => {
    // Nur user0@example.com, user10@example.com … treffen auf "user0"
    vi.mocked(listUsers).mockResolvedValue([
      { id: '1', email: 'anna@firma.de', active: true, role: 'user', job_count: 0, created_at: '' },
      { id: '2', email: 'bernd@firma.de', active: true, role: 'user', job_count: 0, created_at: '' },
      { id: '3', email: 'anna@test.de', active: true, role: 'admin', job_count: 1, created_at: '' },
    ])
    render(<UserManagementSection />)
    const input = await screen.findByPlaceholderText('Nach E-Mail filtern…')
    fireEvent.change(input, { target: { value: 'ann' } })
    expect(screen.getAllByText(/anna@/).length).toBe(2)
    expect(screen.queryByText('bernd@firma.de')).not.toBeInTheDocument()
  })

  it('filter setzt Seite auf 1 zurück', async () => {
    render(<UserManagementSection />)
    const input = await screen.findByPlaceholderText('Nach E-Mail filtern…')
    // Auf Seite 2 navigieren
    fireEvent.click(screen.getByRole('button', { name: /weiter/i }))
    expect(await screen.findByText(/Seite 2 von/)).toBeInTheDocument()
    // Filter eingeben → zurück auf Seite 1
    fireEvent.change(input, { target: { value: 'use' } })
    expect(screen.getByText(/Seite 1 von/)).toBeInTheDocument()
  })

  it('"Zurück"-Button ist auf Seite 1 deaktiviert', async () => {
    render(<UserManagementSection />)
    await screen.findByPlaceholderText('Nach E-Mail filtern…')
    expect(screen.getByRole('button', { name: /zurück/i })).toBeDisabled()
  })

  it('"Weiter"-Button ist auf der letzten Seite deaktiviert', async () => {
    vi.mocked(listUsers).mockResolvedValue(makeUsers(10)) // < 25 → nur 1 Seite
    render(<UserManagementSection />)
    await screen.findByPlaceholderText('Nach E-Mail filtern…')
    expect(screen.getByRole('button', { name: /weiter/i })).toBeDisabled()
  })

  it('"Weiter" navigiert zur nächsten Seite', async () => {
    render(<UserManagementSection />)
    await screen.findByPlaceholderText('Nach E-Mail filtern…')
    fireEvent.click(screen.getByRole('button', { name: /weiter/i }))
    expect(await screen.findByText(/Seite 2 von 3/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Tests ausführen und Fehler bestätigen**

```bash
cd /Users/gerrit/Code/Automate-Eversports-Bookings/frontend
npm run test -- --run UserManagementSection
```

Erwartet: mehrere FAIL-Meldungen (Filter-Input nicht gefunden, Paginierungsbuttons fehlen)

---

### Task 2: Implementierung in UserManagementSection.tsx

**Files:**
- Modify: `frontend/src/components/UserManagementSection.tsx`

- [ ] **Step 1: Datei vollständig ersetzen**

```tsx
import { useState, useEffect, useCallback } from 'react'
import { listUsers, setUserActive } from '../api/users'
import { getEmail } from '../api/client'
import type { UserRecord } from '../types'

const PAGE_SIZE = 25

export default function UserManagementSection() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [emailFilter, setEmailFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const currentEmail = getEmail()

  const load = useCallback(async () => {
    try {
      setUsers(await listUsers())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handleFilterChange(value: string) {
    setEmailFilter(value)
    setCurrentPage(1)
  }

  async function handleToggle(user: UserRecord) {
    if (user.email === currentEmail && user.active) return
    await setUserActive(user.id, !user.active)
    load()
  }

  const filteredUsers = emailFilter.length >= 3
    ? users.filter(u => u.email.toLowerCase().includes(emailFilter.toLowerCase()))
    : users

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const pagedUsers = filteredUsers.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  )

  return (
    <div>
      {loading && <p className="text-slate-400 text-sm">Lädt…</p>}
      {!loading && (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={emailFilter}
            onChange={e => handleFilterChange(e.target.value)}
            placeholder="Nach E-Mail filtern…"
            className="bg-surface-card border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
          />
          <p className="text-slate-500 text-xs">
            {filteredUsers.length} von {users.length} Benutzern · Seite {currentPage} von {totalPages}
          </p>
          {pagedUsers.map(user => {
            const isSelf = user.email === currentEmail
            return (
              <div
                key={user.id}
                className="bg-surface-card rounded-xl px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-white text-sm">{user.email}</p>
                  <p className="text-slate-400 text-xs">
                    {user.role === 'admin' ? 'Admin' : 'User'} ·{' '}
                    {user.active ? 'Aktiv' : 'Inaktiv'} ·{' '}
                    {user.job_count} {user.job_count === 1 ? 'Job' : 'Jobs'}
                  </p>
                </div>
                <button
                  disabled={isSelf}
                  onClick={() => handleToggle(user)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    isSelf
                      ? 'opacity-40 cursor-not-allowed bg-slate-700 text-slate-400'
                      : user.active
                      ? 'bg-red-900 hover:bg-red-700 text-red-300'
                      : 'bg-green-900 hover:bg-green-700 text-green-300'
                  }`}
                >
                  {user.active ? 'Deaktivieren' : 'Aktivieren'}
                </button>
              </div>
            )
          })}
          <div className="flex items-center justify-center gap-3 mt-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="px-3 py-1 rounded-md text-sm bg-surface-card text-slate-400 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-slate-700 transition-colors"
            >
              ← Zurück
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="px-3 py-1 rounded-md text-sm bg-surface-card text-slate-400 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-slate-700 transition-colors"
            >
              Weiter →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Tests ausführen und grün bestätigen**

```bash
cd /Users/gerrit/Code/Automate-Eversports-Bookings/frontend
npm run test -- --run UserManagementSection
```

Erwartet: alle Tests PASS

- [ ] **Step 3: TypeScript-Check**

```bash
cd /Users/gerrit/Code/Automate-Eversports-Bookings/frontend
npx tsc --noEmit
```

Erwartet: keine Fehler

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/UserManagementSection.tsx \
        frontend/src/components/UserManagementSection.test.tsx
git commit -m "feat: add email filter and pagination to user management"
```

---

### Task 3: Manuelle Verifikation im Browser

- [ ] **Step 1: Dev-Server starten**

```bash
cd /Users/gerrit/Code/Automate-Eversports-Bookings
docker compose up -d  # oder lokaler Dev-Stack
```

Oder falls Frontend standalone:
```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Szenarien testen**

1. Admin-Tab "Benutzer" öffnen → Liste erscheint, max. 25 Einträge sichtbar
2. "Weiter" klicken → Seite 2 erscheint, "Zurück" aktiv, "Weiter" ggf. disabled auf letzter Seite
3. Filterfeld: 1–2 Zeichen eingeben → keine Änderung
4. 3+ Zeichen eingeben → Liste filtert live, Seitenanzeige springt auf 1
5. Filter leeren → alle User wieder sichtbar
6. User aktivieren/deaktivieren → Filter und Seite bleiben erhalten nach Reload
