interface MarkProps {
  className?: string
  strokeWidth?: number
}

/** Unendlich-Zeichen – Bildmarke von FOREversports. */
export function LogoMark({ className = 'h-7 w-auto', strokeWidth = 2.4 }: MarkProps) {
  return (
    <svg viewBox="0 6 24 12" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12 12c-2.5-3-4.5-4.5-7-4.5a4.5 4.5 0 0 0 0 9c2.5 0 4.5-1.5 7-4.5s4.5-4.5 7-4.5a4.5 4.5 0 0 1 0 9c-2.5 0-4.5-1.5-7-4.5z"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-accent"
      />
    </svg>
  )
}

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  /** Bildmarke über statt neben dem Schriftzug. */
  stacked?: boolean
}

const SIZES = {
  sm: { mark: 'h-5 w-auto', text: 'text-lg' },
  md: { mark: 'h-6 sm:h-7 w-auto', text: 'text-xl sm:text-[23px]' },
  lg: { mark: 'h-9 w-auto', text: 'text-[28px]' },
}

/** Bildmarke + Schriftzug „FOREversports". */
export default function Logo({ size = 'md', stacked = false }: LogoProps) {
  const s = SIZES[size]
  return (
    <span
      role="img"
      aria-label="FOREversports Logo"
      className={`inline-flex items-center ${stacked ? 'flex-col gap-3.5' : 'gap-3'}`}
    >
      <LogoMark className={s.mark} />
      <span className={`${s.text} font-extrabold tracking-[-0.02em] leading-none`} aria-hidden="true">
        <span className="text-[#f2f7f7]">FOR</span>
        <span className="text-[#9aa9b4]">Eversports</span>
      </span>
    </span>
  )
}
