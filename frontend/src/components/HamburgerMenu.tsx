import { useState, useEffect, useRef } from 'react'

interface Props {
  onLogout: () => void
  onSettings: () => void
  userEmail?: string | null
  userAvatar?: string | null
}

export default function HamburgerMenu({ onLogout, onSettings, userEmail, userAvatar }: Props) {
  const [open, setOpen] = useState(false)
  const [tooltipVisible, setTooltipVisible] = useState(false)
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
    <div ref={ref} className="relative flex items-center gap-2">
      {userEmail && (
        <div className="relative">
          <button
            onMouseEnter={() => setTooltipVisible(true)}
            onMouseLeave={() => setTooltipVisible(false)}
            onClick={() => setTooltipVisible(v => !v)}
            className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-700 hover:bg-slate-600 transition-colors"
            aria-label={`Angemeldet als ${userEmail}`}
          >
            {userAvatar
              ? <img src={userAvatar} alt="Profil" className="w-7 h-7 rounded-full object-cover" />
              : <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-slate-200" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                </svg>
            }
          </button>
          {tooltipVisible && (
            <div className="absolute right-0 mt-2 px-3 py-2 rounded-lg bg-surface-card border border-slate-700 shadow-lg z-50 whitespace-nowrap text-sm text-slate-200">
              Angemeldet als {userEmail}
            </div>
          )}
        </div>
      )}
      <div className="relative">
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
    </div>
  )
}
