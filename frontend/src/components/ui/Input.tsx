import type { InputHTMLAttributes } from 'react'

export type InputVariant = 'default' | 'filter' | 'inline'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  variant?: InputVariant
}

const AUTOFILL = '[&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_var(--color-surface-input)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:white]'

const AUTOFILL_TRANSPARENT = '[&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_transparent_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:white]'

const VARIANTS: Record<InputVariant, string> = {
  default: `bg-surface-input text-white rounded-lg px-3 py-2 w-full outline-hidden focus:ring-2 focus:ring-brand [color-scheme:dark] ${AUTOFILL}`,
  filter:  `bg-surface-card border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 w-full [color-scheme:dark] ${AUTOFILL}`,
  inline:  `bg-transparent text-white text-sm w-full outline-hidden placeholder:text-slate-500 [color-scheme:dark] ${AUTOFILL_TRANSPARENT}`,
}

export default function Input({ variant = 'default', ...props }: InputProps) {
  return <input className={VARIANTS[variant]} {...props} />
}
