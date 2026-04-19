import { useState, useEffect, useRef } from 'react'

interface Props {
  onLogout: () => void
  onSettings: () => void
}

export default function HamburgerMenu({ onLogout, onSettings }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex flex-col justify-center items-center w-9 h-9 gap-1.5 rounded-md bg-slate-700 hover:bg-slate-600 transition-colors"
        aria-label="Menü öffnen"
      >
        <span className="block w-5 h-0.5 bg-slate-200" />
        <span className="block w-5 h-0.5 bg-slate-200" />
        <span className="block w-5 h-0.5 bg-slate-200" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-44 rounded-lg bg-surface-card border border-slate-700 shadow-lg z-50 overflow-hidden">
          <button
            onClick={() => { setOpen(false); onSettings() }}
            className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Einstellungen
          </button>
          <div className="border-t border-slate-700" />
          <button
            onClick={() => { setOpen(false); onLogout() }}
            className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
          >
            Abmelden
          </button>
        </div>
      )}
    </div>
  )
}
