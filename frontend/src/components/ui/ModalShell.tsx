import { useEffect } from 'react'
import type { ReactNode, MouseEvent } from 'react'

interface ModalShellProps {
  onBackdropClick?: () => void
  maxWidth?: 'sm' | 'md' | 'lg'
  scrollable?: boolean
  zIndex?: 'z-50' | 'z-60'
  testId?: string
  cardTestId?: string
  children: ReactNode
}

const MAX_WIDTHS = { sm: 'max-w-[460px]', md: 'max-w-[560px]', lg: 'max-w-2xl' }

export default function ModalShell({
  onBackdropClick,
  maxWidth = 'md',
  scrollable = false,
  zIndex = 'z-50',
  testId,
  cardTestId,
  children,
}: ModalShellProps) {
  // Seite hinter dem Dialog nicht mitscrollen lassen.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

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
          role="dialog"
          aria-modal="true"
          className={`relative bg-surface-card border border-line rounded-[22px] sm:rounded-[26px] shadow-[0_40px_120px_rgba(0,0,0,.6)] w-full ${MAX_WIDTHS[maxWidth]} p-5 sm:p-8${scrollable ? ' max-h-[80vh] overflow-y-auto overscroll-contain' : ''}`}
          data-testid={cardTestId}
          onClick={(e: MouseEvent) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
