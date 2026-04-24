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
    vi.mocked(getMe).mockResolvedValue({ email: 'admin@example.com', role: 'admin', subscription_active: false, total_bookings_executed: 0 })
    renderModal()
    expect(await screen.findByRole('heading', { name: 'Abonnement' })).toBeInTheDocument()
  })

  it('Button deaktiviert wenn Abo aktiv', async () => {
    vi.mocked(isActualAdmin).mockReturnValue(true)
    vi.mocked(getMe).mockResolvedValue({ email: 'admin@example.com', role: 'admin', subscription_active: true, total_bookings_executed: 5 })
    renderModal()
    const btn = await screen.findByRole('button', { name: /abo bereits aktiv/i })
    expect(btn).toBeDisabled()
  })

  it('Button aktiv wenn kein Abo', async () => {
    vi.mocked(isActualAdmin).mockReturnValue(true)
    vi.mocked(getMe).mockResolvedValue({ email: 'admin@example.com', role: 'admin', subscription_active: false, total_bookings_executed: 0 })
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
    vi.mocked(getMe).mockResolvedValue({ email: 'admin@example.com', role: 'admin', subscription_active: false, total_bookings_executed: 0 })
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

  it('zeigt Ladetext während Checkout vorbereitet wird', async () => {
    vi.mocked(isActualAdmin).mockReturnValue(true)
    vi.mocked(getMe).mockResolvedValue({ email: 'admin@example.com', role: 'admin', subscription_active: false, total_bookings_executed: 0 })
    let resolveCheckout!: (value: { url: string }) => void
    vi.mocked(createCheckoutSession).mockReturnValue(new Promise(res => { resolveCheckout = res }))
    renderModal()
    const btn = await screen.findByRole('button', { name: /abo kaufen/i })
    fireEvent.click(btn)
    expect(await screen.findByRole('button', { name: /wird vorbereitet/i })).toBeDisabled()
    resolveCheckout({ url: 'https://checkout.stripe.com/pay/test' })
  })

  it('zeigt Fehlermeldung bei Checkout-Fehler', async () => {
    vi.mocked(isActualAdmin).mockReturnValue(true)
    vi.mocked(getMe).mockResolvedValue({ email: 'admin@example.com', role: 'admin', subscription_active: false, total_bookings_executed: 0 })
    vi.mocked(createCheckoutSession).mockRejectedValue(new Error('Stripe nicht erreichbar'))
    renderModal()
    const btn = await screen.findByRole('button', { name: /abo kaufen/i })
    fireEvent.click(btn)
    expect(await screen.findByText('Stripe nicht erreichbar')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /abo kaufen/i })).not.toBeDisabled()
  })
})
