import type { InputHTMLAttributes } from 'react'

export type InputVariant = 'default' | 'filter' | 'inline'

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  variant?: InputVariant
}

const AUTOFILL = '[&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_var(--color-surface-input)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:white]'

const AUTOFILL_TRANSPARENT = '[&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_transparent_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:white]'

const FOCUS = 'outline-none transition-[border-color,box-shadow] duration-150 focus:border-accent focus:shadow-[0_0_0_4px_rgba(46,184,166,.18)]'

const VARIANTS: Record<InputVariant, string> = {
  default: `bg-surface-input border border-line text-white rounded-[14px] px-4 min-h-[52px] text-base w-full placeholder:text-[#6b7f8c] [color-scheme:dark] ${FOCUS} ${AUTOFILL}`,
  filter:  `bg-surface-input border border-line rounded-xl px-3.5 min-h-10 text-sm text-white placeholder:text-[#6b7f8c] w-full [color-scheme:dark] ${FOCUS} ${AUTOFILL}`,
  inline:  `bg-transparent text-white text-[15px] w-full outline-none placeholder:text-[#6b7f8c] [color-scheme:dark] ${AUTOFILL_TRANSPARENT}`,
}

export default function Input({ variant = 'default', ...props }: InputProps) {
  return <input className={VARIANTS[variant]} {...props} />
}
