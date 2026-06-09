import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../api/account', () => ({
  deleteAccount: vi.fn(),
  getMe: vi.fn().mockResolvedValue({
    total_bookings_executed: 0,
    max_active_jobs: null,
    notification_advance_minutes: 60,
  }),
  updateAccount: vi.fn().mockResolvedValue({
    total_bookings_executed: 0,
    max_active_jobs: null,
    notification_advance_minutes: 30,
  }),
}))
vi.mock('../api/client', () => ({
  clearToken: vi.fn(),
}))
vi.mock('../api/calendar', () => ({
  getCalendarToken: vi.fn().mockResolvedValue({ token: 'test-token' }),
  regenerateCalendarToken: vi.fn().mockResolvedValue({ token: 'new-token' }),
}))

import SettingsModal from './SettingsModal'
import { deleteAccount } from '../api/account'
import { clearToken } from '../api/client'

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

// Gruppen-Header tragen aria-expanded — so lassen sie sich von gleichnamigen
// Aktions-Buttons unterscheiden (z.B. „Konto löschen" als Header und als Lösch-Button)
function groupHeader(name: RegExp): HTMLElement {
  const header = screen
    .getAllByRole('button', { name })
    .find((b) => b.hasAttribute('aria-expanded'))
  if (!header) throw new Error(`Gruppen-Header ${name} nicht gefunden`)
  return header
}

function deleteButton(): HTMLElement {
  const btn = screen
    .getAllByRole('button', { name: /konto löschen/i })
    .find((b) => !b.hasAttribute('aria-expanded'))
  if (!btn) throw new Error('Lösch-Button nicht gefunden')
  return btn
}

function openKontoGroup() {
  fireEvent.click(groupHeader(/^Konto löschen$/i))
}

function openVerhaltenGroup() {
  fireEvent.click(groupHeader(/^Verhalten$/i))
}

beforeAll(() => {
  if (!('Notification' in window)) {
    Object.defineProperty(window, 'Notification', {
      value: { requestPermission: vi.fn() },
      writable: true,
    })
  }
  if (!('serviceWorker' in navigator)) {
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {},
      writable: true,
    })
  }
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('SettingsModal', () => {
  it('renders the settings heading', () => {
    renderModal()
    expect(screen.getByRole('heading', { name: 'Einstellungen' })).toBeInTheDocument()
  })

  it('renders Kalender abonnieren, Verhalten and Konto löschen group headers', () => {
    renderModal()
    expect(groupHeader(/^Kalender abonnieren$/i)).toBeInTheDocument()
    expect(groupHeader(/^Verhalten$/i)).toBeInTheDocument()
    expect(groupHeader(/^Konto löschen$/i)).toBeInTheDocument()
  })

  it('Kalender abonnieren group is expanded by default', () => {
    renderModal()
    expect(groupHeader(/^Kalender abonnieren$/i)).toHaveAttribute('aria-expanded', 'true')
    expect(groupHeader(/^Verhalten$/i)).toHaveAttribute('aria-expanded', 'false')
  })

  it('Konto löschen group is collapsed by default', () => {
    renderModal()
    expect(groupHeader(/^Konto löschen$/i)).toHaveAttribute('aria-expanded', 'false')
  })

  it('Terminerinnerung content is visible when Verhalten is open', async () => {
    renderModal()
    openVerhaltenGroup()
    expect(await screen.findByLabelText('Minuten vor dem Termin')).toBeInTheDocument()
  })

  it('Konto löschen content is not visible when Konto is collapsed', () => {
    renderModal()
    expect(screen.queryByText(/dauerhaft gelöscht/i)).not.toBeInTheDocument()
  })

  it('opening Konto group shows delete section and marks it expanded', () => {
    renderModal()
    openKontoGroup()
    expect(groupHeader(/^Konto löschen$/i)).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText(/dauerhaft gelöscht/i)).toBeInTheDocument()
  })

  it('opening Konto group collapses Kalender abonnieren', () => {
    renderModal()
    openKontoGroup()
    expect(groupHeader(/^Kalender abonnieren$/i)).toHaveAttribute('aria-expanded', 'false')
  })

  it('opening Verhalten group collapses Konto', () => {
    renderModal()
    openKontoGroup()
    openVerhaltenGroup()
    expect(screen.queryByText(/dauerhaft gelöscht/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Verhalten$/i })).toHaveAttribute('aria-expanded', 'true')
  })

  it('shows the irreversibility warning when Konto is open', () => {
    renderModal()
    openKontoGroup()
    expect(screen.getByText(/dauerhaft gelöscht/i)).toBeInTheDocument()
  })

  it('delete button is disabled when input is empty', () => {
    renderModal()
    openKontoGroup()
    expect(deleteButton()).toBeDisabled()
  })

  it('delete button is disabled when input is wrong', () => {
    renderModal()
    openKontoGroup()
    fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'delete' } })
    expect(deleteButton()).toBeDisabled()
  })

  it('delete button is enabled when DELETE is typed exactly', () => {
    renderModal()
    openKontoGroup()
    fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } })
    expect(deleteButton()).not.toBeDisabled()
  })

  it('calls deleteAccount, clearToken, and navigates to / on success', async () => {
    vi.mocked(deleteAccount).mockResolvedValue(undefined)
    renderModal()
    openKontoGroup()
    fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } })
    fireEvent.click(deleteButton())
    await waitFor(() => {
      expect(deleteAccount).toHaveBeenCalledOnce()
      expect(clearToken).toHaveBeenCalledOnce()
      expect(mockNavigate).toHaveBeenCalledWith('/')
    })
  })

  it('shows error message when deleteAccount fails', async () => {
    vi.mocked(deleteAccount).mockRejectedValue(new Error('Serverfehler'))
    renderModal()
    openKontoGroup()
    fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } })
    fireEvent.click(deleteButton())
    expect(await screen.findByText('Serverfehler')).toBeInTheDocument()
    expect(clearToken).not.toHaveBeenCalled()
    expect(mockNavigate).not.toHaveBeenCalled()
  })

  it('calls onClose when the X button is clicked', () => {
    const onClose = vi.fn()
    renderModal(onClose)
    fireEvent.click(screen.getByLabelText('Schließen'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('loads current notification_advance_minutes from API', async () => {
    renderModal()
    openVerhaltenGroup()
    const input = await screen.findByLabelText('Minuten vor dem Termin') as HTMLInputElement
    expect(input.value).toBe('60')
  })

  it('saves notification_advance_minutes on submit', async () => {
    const { updateAccount } = await import('../api/account')
    renderModal()
    openVerhaltenGroup()
    const input = await screen.findByLabelText('Minuten vor dem Termin')
    fireEvent.change(input, { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await waitFor(() => {
      expect(updateAccount).toHaveBeenCalledWith({ notification_advance_minutes: 30 })
    })
  })
})
