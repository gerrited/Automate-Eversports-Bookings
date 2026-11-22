import { useState, useRef, useEffect } from 'react'
import type { KeyboardEvent } from 'react'

interface Props {
  value: number
  onChange: (n: number) => void
  min: number
  max: number
  'aria-label'?: string
}

export default function Stepper({ value, onChange, min, max, 'aria-label': ariaLabel }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit() {
    setDraft(String(value))
    setEditing(true)
  }

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  function commitEdit() {
    const n = parseInt(draft, 10)
    if (!isNaN(n)) onChange(Math.min(max, Math.max(min, n)))
    setEditing(false)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') commitEdit()
    if (e.key === 'Escape') { e.preventDefault(); setEditing(false) }
  }

  const sideBtnClass =
    'w-11 h-11 text-xl text-slate-200 bg-surface-input hover:bg-[#12313a] transition-colors flex items-center justify-center'
  const valueClass =
    'min-w-12 h-11 px-1 text-center text-[17px] font-extrabold tabular-nums text-white bg-transparent'

  return (
    <div role="group" aria-label={ariaLabel} className="flex items-center border border-line-strong rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        aria-label="Verringern"
        className={sideBtnClass}
      >
        −
      </button>
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          value={draft}
          min={min}
          max={max}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKeyDown}
          className={`${valueClass} w-12 outline-none [color-scheme:dark] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none`}
        />
      ) : (
        <button type="button" onClick={startEdit} className={valueClass}>
          {value}
        </button>
      )}
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        aria-label="Erhöhen"
        className={sideBtnClass}
      >
        +
      </button>
    </div>
  )
}
