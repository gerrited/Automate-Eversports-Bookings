import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/account', () => ({
  getMe: vi.fn(),
  deleteAccount: vi.fn(),
}))

vi.mock('../api/jobs', () => ({
  listJobs: vi.fn(),
  createJob: vi.fn(),
  updateJob: vi.fn(),
  toggleJob: vi.fn(),
  deleteJob: vi.fn(),
  getJobLogs: vi.fn(),
  executeJob: vi.fn(),
}))

vi.mock('../api/bookedAppointments', () => ({
  getUpcomingBookings: vi.fn(),
  cancelBooking: vi.fn(),
}))

vi.mock('../api/client', () => ({
  isAdmin: vi.fn().mockReturnValue(false),
  isActualAdmin: vi.fn().mockReturnValue(false),
  getEmail: vi.fn().mockReturnValue('user@example.com'),
  getAvatarUrl: vi.fn().mockReturnValue(null),
  clearToken: vi.fn(),
  setToken: vi.fn(),
  setRole: vi.fn(),
  getRole: vi.fn().mockReturnValue(null),
  setEmail: vi.fn(),
  setAvatarUrl: vi.fn(),
  setIsActualAdmin: vi.fn(),
  apiFetch: vi.fn(),
}))

vi.mock('../api/auth', () => ({
  login: vi.fn(),
  logout: vi.fn(),
}))

import { getMe } from '../api/account'
import { listJobs } from '../api/jobs'
import DashboardPage from './DashboardPage'

function renderDashboard() {
  return render(
    <MemoryRouter initialEntries={['/#bookings']}>
      <DashboardPage />
    </MemoryRouter>
  )
}

beforeEach(() => {
  vi.mocked(listJobs).mockResolvedValue([])
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('DashboardPage – Buchungszähler-Nachricht', () => {
  it('zeigt keine Nachricht wenn total_bookings_executed === 0', async () => {
    vi.mocked(getMe).mockResolvedValue({ total_bookings_executed: 0 } as any)

    renderDashboard()

    // Wait for listJobs to settle, then confirm no counter message
    await screen.findByText('+ Buchung planen')
    expect(screen.queryByText(/automatisch durchgeführt/)).not.toBeInTheDocument()
  })

  it('zeigt Singular-Nachricht wenn total_bookings_executed === 1', async () => {
    vi.mocked(getMe).mockResolvedValue({ total_bookings_executed: 1 } as any)

    renderDashboard()

    // The counter text is split across multiple DOM nodes inside a <p>; match only the <p> element
    const msg = await screen.findByText((_, element) => {
      if (!element || element.tagName !== 'P') return false
      const text = element.textContent ?? ''
      return text.includes('wurde bereits') && text.includes('1') && text.includes('Buchung automatisch durchgeführt')
    })
    expect(msg).toBeInTheDocument()
  })

  it('zeigt Plural-Nachricht wenn total_bookings_executed > 1', async () => {
    vi.mocked(getMe).mockResolvedValue({ total_bookings_executed: 5 } as any)

    renderDashboard()

    const msg = await screen.findByText((_, element) => {
      if (!element || element.tagName !== 'P') return false
      const text = element.textContent ?? ''
      return text.includes('wurden bereits') && text.includes('5') && text.includes('Buchungen automatisch durchgeführt')
    })
    expect(msg).toBeInTheDocument()
  })
})
