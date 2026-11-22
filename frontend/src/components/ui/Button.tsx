import type { ReactNode, MouseEvent } from 'react'

export type ButtonVariant = 'primary' | 'ghost' | 'outline' | 'secondary' | 'danger' | 'slate' | 'success'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps {
  variant: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  fullWidth?: boolean
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  title?: string
  onClick?: (e: MouseEvent<HTMLButtonElement>) => void
  'aria-label'?: string
  children: ReactNode
}

const BASE = 'inline-flex items-center justify-center gap-2 transition-[background-color,border-color,color,box-shadow] duration-150 disabled:opacity-50 disabled:cursor-not-allowed'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:   'bg-brand hover:enabled:bg-brand-hover hover:enabled:shadow-[0_10px_30px_rgba(0,67,73,.45)] text-white font-bold',
  ghost:     'text-muted hover:text-white font-semibold',
  outline:   'border border-line-strong text-slate-300 hover:enabled:bg-white/5 hover:enabled:text-white font-semibold',
  secondary: 'bg-surface-card border border-line text-muted hover:enabled:bg-surface-input hover:enabled:text-white font-semibold',
  danger:    'border border-red-900 bg-red-800/20 text-red-300 hover:enabled:bg-red-800 hover:enabled:text-white font-semibold',
  slate:     'bg-slate-700 hover:enabled:bg-[#3e4c63] text-slate-200 font-semibold',
  success:   'border border-green-900 bg-green-800/20 text-green-300 hover:enabled:bg-green-800 hover:enabled:text-white font-semibold',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'min-h-9 px-3.5 text-sm rounded-[10px]',
  md: 'min-h-10 px-3.5 sm:px-4 text-sm rounded-xl',
  lg: 'min-h-[50px] px-6 text-base rounded-[14px]',
}

export default function Button({
  variant,
  size = 'md',
  loading = false,
  fullWidth = false,
  type = 'button',
  disabled = false,
  title,
  onClick,
  'aria-label': ariaLabel,
  children,
}: ButtonProps) {
  const sizeClass = variant === 'ghost' ? '' : SIZES[size]
  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      className={[BASE, VARIANTS[variant], sizeClass, fullWidth ? 'w-full' : ''].filter(Boolean).join(' ')}
    >
      {loading && (
        <span className="h-3.5 w-3.5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
      )}
      {children}
    </button>
  )
}
