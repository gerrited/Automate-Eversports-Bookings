import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import FaqModal from './FaqModal'

describe('FaqModal', () => {
  it('renders the modal title', () => {
    render(<FaqModal onClose={() => {}} />)
    expect(screen.getByText('Häufig gestellte Fragen')).toBeInTheDocument()
  })

  it('renders all 5 FAQ questions', () => {
    render(<FaqModal onClose={() => {}} />)
    expect(screen.getByText('Wie viele Buchungen kann ich planen?')).toBeInTheDocument()
    expect(screen.getByText('Werden alle Anbieter, Kurse und Klassen bei Eversports unterstützt?')).toBeInTheDocument()
    expect(screen.getByText('Was sind einmalige Buchungen?')).toBeInTheDocument()
    expect(screen.getByText('Wie werden meine Zugangsdaten gespeichert?')).toBeInTheDocument()
    expect(screen.getByText('Welche E-Mails erhalte ich?')).toBeInTheDocument()
  })

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn()
    render(<FaqModal onClose={onClose} />)
    await userEvent.click(screen.getByTestId('faq-modal-backdrop'))
    expect(onClose).toHaveBeenCalledOnce()
  })

  it('does not call onClose when modal card is clicked', async () => {
    const onClose = vi.fn()
    render(<FaqModal onClose={onClose} />)
    await userEvent.click(screen.getByTestId('faq-modal-card'))
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose when close button is clicked', async () => {
    const onClose = vi.fn()
    render(<FaqModal onClose={onClose} />)
    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
