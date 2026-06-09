import type { ReactNode } from 'react'

export type AlertType = 'error' | 'success'

interface Props {
  type: AlertType
  children: ReactNode
  className?: string
}

const STYLES: Record<AlertType, string> = {
  error: 'text-red-400 text-sm',
  success: 'text-green-400 text-sm',
}

export default function AlertMessage({ type, children, className }: Props) {
  return (
    <p className={[STYLES[type], className].filter(Boolean).join(' ')}>
      {children}
    </p>
  )
}
