import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('../api/adminEmail', () => ({
  sendTestEmail: vi.fn(),
}))

import TestEmailModal from './TestEmailModal'
import { sendTestEmail } from '../api/adminEmail'

function renderModal(onClose = vi.fn()) {
  return render(<TestEmailModal onClose={onClose} />)
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('TestEmailModal', () => {
  it('renders all 5 email type buttons with correct German labels', () => {
    renderModal()
    expect(screen.getByRole('button', { name: 'Neuer Benutzer registriert' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Konto freigeschaltet' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Konto deaktiviert' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Buchung fehlgeschlagen' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Debug-Stornierung fehlgeschlagen' })).toBeInTheDocument()
  })

  it('shows "Wird gesendet…" on the clicked button while async call is pending', async () => {
    vi.mocked(sendTestEmail).mockReturnValue(new Promise(() => {}))
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Konto freigeschaltet' }))
    expect(await screen.findByRole('button', { name: 'Wird gesendet…' })).toBeInTheDocument()
  })

  it('disables all buttons while sending is in progress', async () => {
    vi.mocked(sendTestEmail).mockReturnValue(new Promise(() => {}))
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Buchung fehlgeschlagen' }))
    await screen.findByText('Wird gesendet…')
    const buttons = screen.getAllByRole('button')
    const emailButtons = buttons.filter((b) => b.getAttribute('aria-label') !== 'Schließen')
    emailButtons.forEach((btn) => expect(btn).toBeDisabled())
  })

  it('shows success message after a successful send', async () => {
    vi.mocked(sendTestEmail).mockResolvedValue(undefined)
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Benutzer registriert' }))
    expect(await screen.findByText('Test-Mail gesendet.')).toBeInTheDocument()
  })

  it('shows error message after a failed send', async () => {
    vi.mocked(sendTestEmail).mockRejectedValue(new Error('SMTP-Fehler'))
    renderModal()
    fireEvent.click(screen.getByRole('button', { name: 'Konto deaktiviert' }))
    expect(await screen.findByText('SMTP-Fehler')).toBeInTheDocument()
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    renderModal(onClose)
    fireEvent.click(screen.getByLabelText('Schließen'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
