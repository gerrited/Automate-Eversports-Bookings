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

  describe('Barrierefreiheit', () => {
    it('benennt den Dialog nach seiner Überschrift', () => {
      render(<ModalShell><h2>Mein Titel</h2></ModalShell>)
      expect(screen.getByRole('dialog', { name: 'Mein Titel' })).toBeInTheDocument()
    })

    it('verwendet labelledBy, wenn angegeben', () => {
      render(<ModalShell labelledBy="t"><span id="t">Expliziter Titel</span><h2>Andere</h2></ModalShell>)
      expect(screen.getByRole('dialog', { name: 'Expliziter Titel' })).toBeInTheDocument()
    })

    it('holt den Fokus in den Dialog und gibt ihn beim Schließen zurück', () => {
      const trigger = document.createElement('button')
      document.body.appendChild(trigger)
      trigger.focus()
      const { unmount } = render(<ModalShell><h2>Titel</h2><button>Innen</button></ModalShell>)
      expect(screen.getByRole('dialog')).toHaveFocus()
      unmount()
      expect(trigger).toHaveFocus()
      trigger.remove()
    })

    it('überschreibt den Fokus eines autoFocus-Kindes nicht', () => {
      render(<ModalShell><input aria-label="Feld" autoFocus /></ModalShell>)
      expect(screen.getByLabelText('Feld')).toHaveFocus()
    })

    it('Esc ruft onClose auf', () => {
      const onClose = vi.fn()
      render(<ModalShell onClose={onClose}><button>Innen</button></ModalShell>)
      fireEvent.keyDown(screen.getByText('Innen'), { key: 'Escape' })
      expect(onClose).toHaveBeenCalledTimes(1)
    })

    it('Esc fällt auf onBackdropClick zurück', () => {
      const onBackdropClick = vi.fn()
      render(<ModalShell onBackdropClick={onBackdropClick}><button>Innen</button></ModalShell>)
      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
      expect(onBackdropClick).toHaveBeenCalledTimes(1)
    })

    it('Esc schließt nicht, wenn ein inneres Widget es bereits behandelt hat', () => {
      const onClose = vi.fn()
      render(
        <ModalShell onClose={onClose}>
          <input aria-label="Feld" onKeyDown={e => { if (e.key === 'Escape') e.preventDefault() }} />
        </ModalShell>
      )
      fireEvent.keyDown(screen.getByLabelText('Feld'), { key: 'Escape' })
      expect(onClose).not.toHaveBeenCalled()
    })

    it('Esc schließt bei verschachtelten Dialogen nur den inneren', () => {
      const outer = vi.fn()
      const inner = vi.fn()
      render(
        <ModalShell onClose={outer}>
          <ModalShell onClose={inner}><button>Innen</button></ModalShell>
        </ModalShell>
      )
      fireEvent.keyDown(screen.getByText('Innen'), { key: 'Escape' })
      expect(inner).toHaveBeenCalledTimes(1)
      expect(outer).not.toHaveBeenCalled()
    })

    it('hält den Fokus mit Tab und Shift+Tab im Dialog', () => {
      render(<ModalShell><button>Erster</button><button>Letzter</button></ModalShell>)
      const first = screen.getByText('Erster')
      const last = screen.getByText('Letzter')

      last.focus()
      fireEvent.keyDown(last, { key: 'Tab' })
      expect(first).toHaveFocus()

      fireEvent.keyDown(first, { key: 'Tab', shiftKey: true })
      expect(last).toHaveFocus()
    })

    it('Shift+Tab vom Dialog-Container springt zum letzten Element', () => {
      render(<ModalShell><button>Erster</button><button>Letzter</button></ModalShell>)
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveFocus()
      fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
      expect(screen.getByText('Letzter')).toHaveFocus()
    })
  })
})
