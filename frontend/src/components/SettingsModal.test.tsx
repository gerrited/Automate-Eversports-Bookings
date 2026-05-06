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

beforeAll(() => {
  // jsdom does not expose Notification or serviceWorker; stub them so the
  // notifications section renders during tests.
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
  it('renders the settings heading and delete section', () => {
    renderModal()
    expect(screen.getByRole('heading', { name: 'Einstellungen' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Konto löschen' })).toBeInTheDocument()
  })

  it('shows the irreversibility warning', () => {
    renderModal()
    expect(screen.getByText(/unwiderruflich/i)).toBeInTheDocument()
  })

  it('delete button is disabled when input is empty', () => {
    renderModal()
    const btn = screen.getByRole('button', { name: /konto löschen/i })
    expect(btn).toBeDisabled()
  })

  it('delete button is disabled when input is wrong', () => {
    renderModal()
    fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'delete' } })
    expect(screen.getByRole('button', { name: /konto löschen/i })).toBeDisabled()
  })

  it('delete button is enabled when DELETE is typed exactly', () => {
    renderModal()
    fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } })
    expect(screen.getByRole('button', { name: /konto löschen/i })).not.toBeDisabled()
  })

  it('calls deleteAccount, clearToken, and navigates to / on success', async () => {
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
    vi.mocked(deleteAccount).mockRejectedValue(new Error('Serverfehler'))
    renderModal()
    fireEvent.change(screen.getByPlaceholderText('DELETE'), { target: { value: 'DELETE' } })
    fireEvent.click(screen.getByRole('button', { name: /konto löschen/i }))
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

  it('renders notification advance minutes field', async () => {
    renderModal()
    expect(await screen.findByLabelText('Minuten vor dem Termin')).toBeInTheDocument()
  })

  it('loads current notification_advance_minutes from API', async () => {
    renderModal()
    const input = await screen.findByLabelText('Minuten vor dem Termin') as HTMLInputElement
    expect(input.value).toBe('60')
  })

  it('saves notification_advance_minutes on submit', async () => {
    const { updateAccount } = await import('../api/account')
    renderModal()
    const input = await screen.findByLabelText('Minuten vor dem Termin')
    fireEvent.change(input, { target: { value: '30' } })
    fireEvent.click(screen.getByRole('button', { name: 'Speichern' }))
    await waitFor(() => {
      expect(updateAccount).toHaveBeenCalledWith({ notification_advance_minutes: 30 })
    })
  })
})
