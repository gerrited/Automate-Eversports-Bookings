import type { ReactNode, MouseEvent } from 'react'

export type ButtonVariant = 'primary' | 'ghost' | 'secondary' | 'danger' | 'slate'
export type ButtonSize = 'sm' | 'md'

interface ButtonProps {
  variant: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  'aria-label'?: string
  children: ReactNode
}

const BASE = 'inline-flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'

const VARIANTS: Record<ButtonVariant, string> = {
  primary: 'bg-brand hover:bg-brand-hover text-white font-semibold rounded-lg',
  ghost:   'text-slate-400 hover:text-white',
  secondary: 'bg-surface-card border border-slate-700 text-slate-400 hover:enabled:bg-slate-700 rounded-md',
  danger:  'bg-red-900 hover:bg-red-700 text-red-300 rounded-lg',
  slate:   'bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1 text-sm',
  md: 'px-4 py-2 text-sm',
}

export default function Button({
  variant,
  size = 'md',
  loading = false,
  fullWidth = false,
  type = 'button',
  disabled = false,
  onClick,
  'aria-label': ariaLabel,
  children,
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={ariaLabel}
      className={[BASE, VARIANTS[variant], SIZES[size], fullWidth ? 'w-full' : ''].filter(Boolean).join(' ')}
    >
      {loading && (
        <span className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
      )}
      {children}
    </button>
  )
}
