import type { ReactNode, MouseEvent } from 'react'

interface ModalShellProps {
  onBackdropClick?: () => void
  maxWidth?: 'sm' | 'md'
  testId?: string
  children: ReactNode
}

const MAX_WIDTHS = { sm: 'max-w-sm', md: 'max-w-md' }

export default function ModalShell({
  onBackdropClick,
  maxWidth = 'md',
  testId,
  children,
}: ModalShellProps) {
  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4"
      data-testid={testId}
      onClick={onBackdropClick}
      onTouchMove={e => e.stopPropagation()}
    >
      <div
        className={`relative bg-surface-card border border-slate-700 rounded-xl w-full ${MAX_WIDTHS[maxWidth]} p-6`}
        onClick={(e: MouseEvent) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
