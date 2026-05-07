import { useState, useRef, useEffect } from 'react'
import { WEEKDAY_NAMES } from '../../types'

const LABELS = ['M', 'D', 'M', 'D', 'F', 'S', 'S']
const LONGPRESS_MS = 500
const AUTOHIDE_MS = 1500

interface Props {
  value: number
  onChange: (day: number) => void
}

export default function WeekdaySelector({ value, onChange }: Props) {
  const [tooltip, setTooltip] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autoHideRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const didLongPress = useRef(false)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (autoHideRef.current) clearTimeout(autoHideRef.current)
    }
  }, [])

  function handlePointerDown(i: number) {
    didLongPress.current = false
    timerRef.current = setTimeout(() => {
      didLongPress.current = true
      setTooltip(i)
      autoHideRef.current = setTimeout(() => setTooltip(null), AUTOHIDE_MS)
    }, LONGPRESS_MS)
  }

  function handlePointerUp(i: number) {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (autoHideRef.current) clearTimeout(autoHideRef.current)
    if (!didLongPress.current) onChange(i)
    setTooltip(null)
    didLongPress.current = false
  }

  function handlePointerCancel() {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (autoHideRef.current) clearTimeout(autoHideRef.current)
    setTooltip(null)
    didLongPress.current = false
  }

  return (
    <div
      role="group"
      aria-label="Wochentag"
      className="flex gap-1 overflow-x-auto"
      style={{ scrollbarWidth: 'none' }}
    >
      {LABELS.map((label, i) => (
        <div key={i} className="relative shrink-0">
          {tooltip === i && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 bg-slate-700 text-white text-xs rounded whitespace-nowrap z-10 pointer-events-none">
              {WEEKDAY_NAMES[i]}
            </div>
          )}
          <button
            type="button"
            aria-pressed={value === i}
            onPointerDown={() => handlePointerDown(i)}
            onPointerUp={() => handlePointerUp(i)}
            onPointerCancel={handlePointerCancel}
            onPointerLeave={handlePointerCancel}
            className={`w-[30px] h-[30px] rounded-md text-xs font-bold select-none ${
              value === i
                ? 'bg-brand text-white'
                : 'bg-surface-card text-slate-500 border border-slate-700'
            }`}
          >
            {label}
          </button>
        </div>
      ))}
    </div>
  )
}
