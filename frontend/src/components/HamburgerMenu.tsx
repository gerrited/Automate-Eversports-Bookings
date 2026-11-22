import { useState, useEffect, useRef } from 'react'
import { setRole } from '../api/client'

interface Props {
  onLogout: () => void
  onSettings: () => void
  onTestEmails: () => void
  userEmail?: string | null
  userAvatar?: string | null
  isActualAdmin?: boolean
  isAdminView?: boolean
  maxActiveJobs?: number | null | undefined
}

export default function HamburgerMenu({ onLogout, onSettings, onTestEmails, userEmail, userAvatar, isActualAdmin, isAdminView, maxActiveJobs }: Props) {
  const [open, setOpen] = useState(false)
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setTooltipVisible(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative flex items-center gap-2.5">
      {userEmail && (
        <div className="relative">
          <button
            onClick={() => { setTooltipVisible(v => !v); setOpen(false) }}
            className="flex items-center justify-center w-11 h-11 sm:w-[46px] sm:h-[46px] rounded-full border-2 border-line-strong bg-surface-input text-slate-300 hover:bg-[#1e2c3d] transition-colors overflow-hidden"
            aria-label={`Angemeldet als ${userEmail}`}
          >
            {userAvatar
              ? <img src={userAvatar} alt="Profil" className="w-full h-full rounded-full object-cover" />
              : <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="12" cy="8.5" r="4" /><path d="M4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5" />
                </svg>
            }
          </button>
          {tooltipVisible && (
            <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-surface-card border border-line shadow-[0_20px_50px_rgba(0,0,0,.45)] z-50 overflow-hidden">
              <div className="px-4 py-3.5 text-[13px] text-muted leading-relaxed">
                Angemeldet als<br />
                <span className="text-white font-semibold break-all">{userEmail}</span>
                {maxActiveJobs !== undefined && (
                  <span className="block mt-1 text-faint">
                    {maxActiveJobs != null
                      ? `Max. ${maxActiveJobs} geplante ${maxActiveJobs === 1 ? 'Buchung' : 'Buchungen'}`
                      : 'Beliebig viele geplante Buchungen'}
                  </span>
                )}
              </div>
              {isActualAdmin && (
                <>
                  <div className="border-t border-line-subtle" />
                  <label className="flex items-center gap-2.5 px-4 py-3 text-sm text-slate-200 hover:bg-surface-raised transition-colors cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isAdminView ?? false}
                      onChange={e => {
                        setRole(e.target.checked ? 'admin' : 'user')
                        window.dispatchEvent(new Event('auth-changed'))
                        setTooltipVisible(false)
                      }}
                      className="w-4 h-4 accent-accent"
                    />
                    Admin
                  </label>
                </>
              )}
            </div>
          )}
        </div>
      )}
      <div className="relative">
        <button
          onClick={() => { setOpen(o => !o); setTooltipVisible(false) }}
          className="flex justify-center items-center w-11 h-11 sm:w-[46px] sm:h-[46px] rounded-xl bg-[#162433] text-slate-300 hover:bg-[#1e2c3d] transition-colors"
          aria-label="Menü öffnen"
          aria-expanded={open}
        >
          <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </button>

        {open && (
          <div className="absolute right-0 mt-2 w-52 rounded-2xl bg-surface-card border border-line shadow-[0_20px_50px_rgba(0,0,0,.45)] z-50 overflow-hidden">
            <button
              onClick={() => { setOpen(false); onSettings() }}
              className="w-full text-left px-4 py-3 text-[15px] font-medium text-slate-200 hover:bg-surface-raised hover:text-white transition-colors"
            >
              Einstellungen
            </button>
            {isAdminView && (
              <>
                <div className="border-t border-line-subtle" />
                <button
                  onClick={() => { setOpen(false); onTestEmails() }}
                  className="w-full text-left px-4 py-3 text-[15px] font-medium text-slate-200 hover:bg-surface-raised hover:text-white transition-colors"
                >
                  Test-Mails
                </button>
              </>
            )}
            <div className="border-t border-line-subtle" />
            <button
              onClick={() => { setOpen(false); onLogout() }}
              className="w-full text-left px-4 py-3 text-[15px] font-medium text-slate-200 hover:bg-surface-raised hover:text-white transition-colors"
            >
              Abmelden
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
