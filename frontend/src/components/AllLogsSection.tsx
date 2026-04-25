import { useState, useEffect, useCallback } from 'react'
import { listAllLogs } from '../api/adminLogs'
import { WEEKDAY_NAMES } from '../types'
import type { AdminLogsPage } from '../types'

const PAGE_SIZE = 50

const STATUS_STYLES: Record<string, string> = {
  success: 'text-green-400',
  failed: 'text-red-400',
  already_booked: 'text-slate-400',
  waitlist: 'text-yellow-400',
}

const STATUS_LABELS: Record<string, string> = {
  success: 'Erfolgreich',
  failed: 'Fehlgeschlagen',
  already_booked: 'Bereits gebucht',
  waitlist: 'Warteliste',
}

export default function AllLogsSection() {
  const [result, setResult] = useState<AdminLogsPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [emailFilter, setEmailFilter] = useState('')
  const [debouncedFilter, setDebouncedFilter] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [expandedMessage, setExpandedMessage] = useState<string | null>(null)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilter(emailFilter)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [emailFilter])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listAllLogs(currentPage, debouncedFilter || undefined)
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden')
    } finally {
      setLoading(false)
    }
  }, [currentPage, debouncedFilter])

  useEffect(() => { load() }, [load])

  const items = result?.items ?? []
  const total = result?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div>
      {loading && !result && <p className="text-slate-400 text-sm">Lädt…</p>}
      <div className="flex flex-col gap-2">
        <input
          type="text"
          value={emailFilter}
          onChange={e => setEmailFilter(e.target.value)}
          placeholder="Nach E-Mail filtern…"
          className="flex-1 bg-surface-card border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
        />
        {!loading && !error && result && (
          <p className="text-slate-500 text-xs">
            {total} Einträge · Seite {currentPage} von {totalPages}
          </p>
        )}
        {error && <p className="text-red-400 text-sm">{error}</p>}
        {!loading && !error && items.length === 0 && (
          <p className="text-slate-400 text-sm text-center mt-12">Keine Logs gefunden.</p>
        )}
        {items.map(log => {
          const displayTime = log.target_time.slice(0, 5)
          const truncated =
            log.message && log.message.length > 60
              ? log.message.slice(0, 60) + '…'
              : log.message
          return (
            <div key={log.id} className="bg-surface-card rounded-xl px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium truncate">{log.user_email}</p>
                  <p className="text-slate-300 text-sm">
                    {WEEKDAY_NAMES[log.weekday]} · {displayTime} Uhr · {log.class_name}
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {log.facility_name}
                    {log.debug && (
                      <span className="ml-1 text-amber-400 font-medium">Test</span>
                    )}
                  </p>
                  {truncated && (
                    <p className="text-slate-500 text-xs mt-0.5">
                      {truncated}
                      {log.message && log.message.length > 60 && (
                        <button
                          className="ml-1 text-brand hover:text-brand-hover text-xs"
                          onClick={() => setExpandedMessage(log.message)}
                        >
                          mehr
                        </button>
                      )}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-xs font-medium ${STATUS_STYLES[log.status] ?? 'text-slate-400'}`}>
                    {STATUS_LABELS[log.status] ?? log.status}
                  </p>
                  <p className="text-slate-500 text-xs mt-0.5">
                    {new Date(log.executed_at).toLocaleString('de-DE')}
                  </p>
                  <p className="text-slate-600 text-xs">
                    Ziel: {log.target_date}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
        {result && (
          <div className="flex items-center justify-center gap-3 mt-2">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="px-3 py-1 rounded-md text-sm bg-surface-card text-slate-400 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-slate-700 transition-colors"
            >
              ← Zurück
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="px-3 py-1 rounded-md text-sm bg-surface-card text-slate-400 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-slate-700 transition-colors"
            >
              Weiter →
            </button>
          </div>
        )}
      </div>
      {expandedMessage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setExpandedMessage(null)}
        >
          <div
            className="bg-surface-card rounded-xl p-4 max-w-lg w-full"
            onClick={e => e.stopPropagation()}
          >
            <p className="text-slate-200 text-sm break-all">{expandedMessage}</p>
            <button
              className="mt-3 text-slate-400 text-sm hover:text-white"
              onClick={() => setExpandedMessage(null)}
            >
              Schließen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
