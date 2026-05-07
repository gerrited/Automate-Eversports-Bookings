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
    if (e.key === 'Escape') setEditing(false)
  }

  const sideBtnClass =
    'w-[30px] h-[30px] text-slate-400 bg-surface-card border border-slate-700 text-base flex items-center justify-center'

  return (
    <div role="group" aria-label={ariaLabel} className="flex items-center">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className={`${sideBtnClass} rounded-l-md border-r-0`}
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
          className="w-8 h-[30px] text-center text-sm font-semibold text-white bg-surface-input border-y border-slate-700 outline-none [color-scheme:dark]"
        />
      ) : (
        <button
          type="button"
          onClick={startEdit}
          className="min-w-8 h-[30px] px-1 text-center text-sm font-semibold text-white bg-surface-input border-y border-slate-700"
        >
          {value}
        </button>
      )}
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        className={`${sideBtnClass} rounded-r-md border-l-0`}
      >
        +
      </button>
    </div>
  )
}
