import { render, screen, fireEvent } from '@testing-library/react'
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

afterEach(() => {
  vi.clearAllMocks()
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

  it('filter ab 1 Zeichen begrenzt Ergebnisse', async () => {
    vi.mocked(listUsers).mockResolvedValue([
      { id: '1', email: 'anna@firma.de', active: true, role: 'user', job_count: 0, created_at: '' },
      { id: '2', email: 'bernd@xyz.org', active: true, role: 'user', job_count: 0, created_at: '' },
      { id: '3', email: 'anna@test.de', active: true, role: 'admin', job_count: 1, created_at: '' },
    ])
    render(<UserManagementSection />)
    const input = await screen.findByPlaceholderText('Nach E-Mail filtern…')
    fireEvent.change(input, { target: { value: 'a' } })
    expect(screen.getAllByText(/anna@/).length).toBe(2)
    expect(screen.queryByText('bernd@xyz.org')).not.toBeInTheDocument()
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
