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

  it('Klick auf den freien Bereich neben der Karte schließt ebenfalls', () => {
    const onBackdropClick = vi.fn()
    render(<ModalShell onBackdropClick={onBackdropClick} testId="bd"><p>Inhalt</p></ModalShell>)
    // Zwischen Backdrop und Karte liegt ein Zentrier-Container – auch dessen Fläche zählt als Hintergrund.
    fireEvent.click(screen.getByTestId('bd').firstChild!)
    expect(onBackdropClick).toHaveBeenCalledTimes(1)
  })

  it('macht den Hintergrund scrollbar, damit hohe Dialoge auf kleinen Bildschirmen erreichbar bleiben', () => {
    render(<ModalShell testId="bd"><p>Inhalt</p></ModalShell>)
    const backdrop = screen.getByTestId('bd')
    expect(backdrop).toHaveClass('overflow-y-auto')
    // Kein touch-none: das würde das Scrollen per Touch auf Mobilgeräten blockieren.
    expect(backdrop).not.toHaveClass('touch-none')
  })

  it('sperrt das Scrollen der Seite und gibt es beim Schließen wieder frei', () => {
    document.body.style.overflow = 'auto'
    const { unmount } = render(<ModalShell><p>Inhalt</p></ModalShell>)
    expect(document.body.style.overflow).toBe('hidden')
    unmount()
    expect(document.body.style.overflow).toBe('auto')
    document.body.style.overflow = ''
  })
})

