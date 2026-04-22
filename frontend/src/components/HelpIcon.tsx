import { useState, useRef, useEffect } from 'react'

interface Props {
  text: string
}

export default function HelpIcon({ text }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  return (
    <span ref={containerRef} className="relative inline-flex items-center">
      <button
        type="button"
        aria-label="Hilfe anzeigen"
        onClick={() => setOpen(v => !v)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-slate-600 text-slate-500 hover:text-slate-300 hover:border-slate-400 text-[10px] font-bold leading-none transition-colors"
      >
        ?
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-1 w-56 bg-[#1e293b] border border-slate-700 rounded-lg p-3 shadow-xl z-50">
          <p className="text-slate-300 text-xs leading-relaxed">{text}</p>
        </div>
      )}
    </span>
  )
}
