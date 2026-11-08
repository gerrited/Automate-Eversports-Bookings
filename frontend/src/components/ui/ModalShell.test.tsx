import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import ModalShell from './ModalShell'

describe('ModalShell', () => {
  it('rendert children', () => {
    render(<ModalShell><p>Inhalt</p></ModalShell>)
    expect(screen.getByText('Inhalt')).toBeInTheDocument()
  })

  it('ruft onBackdropClick auf wenn Backdrop geklickt', () => {
    const onBackdropClick = vi.fn()
    const { container } = render(
      <ModalShell onBackdropClick={onBackdropClick}><p>Inhalt</p></ModalShell>
    )
    fireEvent.click(container.firstChild!)
    expect(onBackdropClick).toHaveBeenCalledTimes(1)
  })

  it('ruft onBackdropClick nicht auf wenn innerer Inhalt geklickt', () => {
    const onBackdropClick = vi.fn()
    render(
      <ModalShell onBackdropClick={onBackdropClick}><p>Inhalt</p></ModalShell>
    )
    fireEvent.click(screen.getByText('Inhalt'))
    expect(onBackdropClick).not.toHaveBeenCalled()
  })

  it('wirft keinen Fehler ohne onBackdropClick', () => {
    const { container } = render(<ModalShell><p>Inhalt</p></ModalShell>)
    expect(() => fireEvent.click(container.firstChild!)).not.toThrow()
  })

  it('setzt data-testid auf Backdrop wenn testId übergeben', () => {
    render(<ModalShell testId="mein-modal"><p>Inhalt</p></ModalShell>)
    expect(screen.getByTestId('mein-modal')).toBeInTheDocument()
  })
})
