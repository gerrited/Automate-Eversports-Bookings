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

const MAX_WIDTHS = { sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg' }

export default function ModalShell({
  onBackdropClick,
  maxWidth = 'md',
  scrollable = false,
  zIndex = 'z-50',
  testId,
  cardTestId,
  children,
}: ModalShellProps) {
  return (
    <div
      className={`fixed inset-0 bg-black/60 ${zIndex} flex items-center justify-center px-4 touch-none`}
      data-testid={testId}
      onClick={onBackdropClick}
    >
      <div
        className={`relative bg-surface-card border border-slate-700 rounded-xl w-full ${MAX_WIDTHS[maxWidth]} p-6 touch-pan-y${scrollable ? ' max-h-[80vh] overflow-y-auto overscroll-contain' : ''}`}
        data-testid={cardTestId}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
