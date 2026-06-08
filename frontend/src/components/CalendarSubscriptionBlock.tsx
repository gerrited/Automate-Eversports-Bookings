import { useEffect, useState } from 'react'
import { getCalendarToken, regenerateCalendarToken } from '../api/calendar'

function buildWebcalUrl(token: string): string {
  return `webcal://${window.location.host}/api/calendar/feed.ics?token=${token}`
}

export default function CalendarSubscriptionBlock() {
  const [token, setToken] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [resetting, setResetting] = useState(false)

  useEffect(() => {
    getCalendarToken().then(r => setToken(r.token)).catch(() => {})
  }, [])

  async function handleCopy() {
    if (!token) return
    await navigator.clipboard.writeText(buildWebcalUrl(token))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleReset() {
    if (!window.confirm('Token zurücksetzen? Der alte Abo-Link wird ungültig.')) return
    setResetting(true)
    try {
      const r = await regenerateCalendarToken()
      setToken(r.token)
    } finally {
      setResetting(false)
    }
  }

  return (
    <div className="rounded-xl bg-surface-card p-4">
      {token ? (
        <>
          <input
            readOnly
            value={buildWebcalUrl(token)}
            className="w-full rounded-lg bg-slate-800 px-3 py-2 text-xs text-slate-400 font-mono mb-3 truncate focus:outline-none"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleCopy}
              className="px-3 py-2 text-sm font-medium rounded-lg bg-brand hover:bg-brand-hover text-white transition-colors"
            >
              {copied ? 'Kopiert!' : 'Kopieren'}
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-3 mb-1">
            Der Kalender aktualisiert sich automatisch.
          </p>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="text-xs text-slate-500 hover:text-slate-400 underline disabled:opacity-50"
          >
            Token zurücksetzen
          </button>
        </>
      ) : (
        <p className="text-xs text-slate-500">Lädt…</p>
      )}
    </div>
  )
}
