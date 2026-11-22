import { useEffect, useRef } from 'react'
import type { ReactNode, MouseEvent, KeyboardEvent } from 'react'

interface ModalShellProps {
  onBackdropClick?: () => void
  /** Schließen per Esc. Standard: wie onBackdropClick. Ohne beides schließt Esc nicht. */
  onClose?: () => void
  /** id des Titel-Elements. Ohne Angabe wird die erste Überschrift im Dialog verwendet. */
  labelledBy?: string
  maxWidth?: 'sm' | 'md' | 'lg'
  scrollable?: boolean
  zIndex?: 'z-50' | 'z-60'
  testId?: string
  cardTestId?: string
  children: ReactNode
}

const MAX_WIDTHS = { sm: 'max-w-[460px]', md: 'max-w-[560px]', lg: 'max-w-2xl' }

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

let titleCounter = 0

function focusableIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    el => !el.closest('[inert]') && el.getAttribute('aria-hidden') !== 'true',
  )
}

export default function ModalShell({
  onBackdropClick,
  onClose,
  labelledBy,
  maxWidth = 'md',
  scrollable = false,
  zIndex = 'z-50',
  testId,
  cardTestId,
  children,
}: ModalShellProps) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const handleClose = onClose ?? onBackdropClick

  // Seite hinter dem Dialog nicht mitscrollen lassen.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  // Fokus in den Dialog holen und beim Schließen an das auslösende Element zurückgeben (WCAG 2.4.3).
  useEffect(() => {
    const dialog = dialogRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null
    // Ein Kind mit autoFocus hat den Fokus bereits – dann nicht überschreiben.
    if (dialog && !dialog.contains(document.activeElement)) dialog.focus()
    return () => {
      if (previouslyFocused && previouslyFocused.isConnected) previouslyFocused.focus()
    }
  }, [])

  // Dialog nach seinem Titel benennen (WCAG 4.1.2), falls nicht explizit angegeben.
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || labelledBy) return
    const heading = dialog.querySelector<HTMLElement>('h1, h2, h3, h4, h5, h6')
    if (!heading) return
    if (!heading.id) heading.id = `modal-title-${++titleCounter}`
    dialog.setAttribute('aria-labelledby', heading.id)
  })

  function handleKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const dialog = dialogRef.current
    if (!dialog) return

    if (e.key === 'Escape') {
      // Innere Widgets (z. B. Eingabe abbrechen) haben Vorrang.
      if (e.defaultPrevented) return
      e.stopPropagation()
      handleClose?.()
      return
    }

    if (e.key !== 'Tab') return
    // Fokusfalle: Tab und Shift+Tab bleiben innerhalb des Dialogs.
    e.stopPropagation()
    const items = focusableIn(dialog)
    if (items.length === 0) {
      e.preventDefault()
      dialog.focus()
      return
    }
    const first = items[0]
    const last = items[items.length - 1]
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === dialog)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }

  return (
    // Der Hintergrund scrollt, nicht die Karte: So bleibt ein hoher Dialog (z. B. das
    // Buchungsformular auf dem Handy) vollständig erreichbar, und Dropdowns innerhalb
    // der Karte werden nicht von einem overflow-Container abgeschnitten.
    <div
      className={`fixed inset-0 bg-[rgba(2,10,12,.74)] backdrop-blur-[2px] ${zIndex} overflow-y-auto overscroll-contain`}
      data-testid={testId}
      onClick={onBackdropClick}
    >
      <div className="min-h-full flex items-center justify-center px-3 py-4 sm:px-4 sm:py-6">
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={labelledBy}
          tabIndex={-1}
          className={`relative bg-surface-card border border-line rounded-[22px] sm:rounded-[26px] shadow-[0_40px_120px_rgba(0,0,0,.6)] w-full ${MAX_WIDTHS[maxWidth]} p-5 sm:p-8 outline-none${scrollable ? ' max-h-[80vh] overflow-y-auto overscroll-contain' : ''}`}
          data-testid={cardTestId}
          onClick={(e: MouseEvent) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
