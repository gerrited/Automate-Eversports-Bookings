import { useState, useEffect, useCallback } from 'react'
import { listAllJobs } from '../api/adminJobs'
import { WEEKDAY_NAMES } from '../types'
import type { AdminJob } from '../types'

const PAGE_SIZE = 25

export default function AllJobsSection({ initialEmailFilter, onUserClick }: { initialEmailFilter?: string; onUserClick?: (email: string) => void } = {}) {
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [loading, setLoading] = useState(true)
  const [emailFilter, setEmailFilter] = useState(initialEmailFilter ?? '')
  const [currentPage, setCurrentPage] = useState(1)

  const load = useCallback(async () => {
    try {
      setJobs(await listAllJobs())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (initialEmailFilter !== undefined) {
      setEmailFilter(initialEmailFilter)
      setCurrentPage(1)
    }
  }, [initialEmailFilter])

  function handleFilterChange(value: string) {
    setEmailFilter(value)
    setCurrentPage(1)
  }

  const filteredJobs = jobs.filter(
    j => emailFilter.length < 1 || j.user_email.toLowerCase().includes(emailFilter.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filteredJobs.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const pagedJobs = filteredJobs.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  )

  return (
    <div>
      {loading && <p className="text-slate-400 text-sm">Lädt…</p>}
      {!loading && (
        <div className="flex flex-col gap-2">
          <input
            type="text"
            value={emailFilter}
            onChange={e => handleFilterChange(e.target.value)}
            placeholder="Nach Benutzer filtern…"
            className="flex-1 bg-surface-card border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
          />
          <p className="text-slate-500 text-xs">
            {filteredJobs.length} von {jobs.length} Jobs · Seite {safePage} von {totalPages}
          </p>
          {filteredJobs.length === 0 && (
            <p className="text-slate-400 text-sm text-center mt-12">Keine Buchungen gefunden.</p>
          )}
          {pagedJobs.map(job => {
            const displayTime = job.target_time.slice(0, 5)
            return (
              <div
                key={job.id}
                className="bg-surface-card rounded-xl px-4 py-3 flex items-center justify-between"
              >
                <div className="flex-1 min-w-0">
                  {onUserClick ? (
                    <button
                      aria-label={`Benutzer ${job.user_email} anzeigen`}
                      onClick={() => onUserClick(job.user_email)}
                      className="text-white text-sm font-medium truncate text-left hover:text-brand transition-colors cursor-pointer"
                    >
                      {job.user_email}
                    </button>
                  ) : (
                    <p className="text-white text-sm font-medium truncate">{job.user_email}</p>
                  )}
                  <p className="text-slate-300 text-sm">
                    {WEEKDAY_NAMES[job.weekday]} · {displayTime} Uhr · <span>{job.class_name}</span>
                  </p>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {job.facility_name} · {job.days_in_advance} Tage im Voraus{job.one_time ? ' · Einmalig' : ''}
                  </p>
                </div>
                <span className="ml-3 shrink-0 text-slate-400 text-xs whitespace-nowrap">
                  {job.execution_count}× ausgeführt
                </span>
              </div>
            )
          })}
          <div className="flex items-center justify-center gap-3 mt-2">
            <button
              disabled={safePage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="px-3 py-1 rounded-md text-sm bg-surface-card text-slate-400 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-slate-700 transition-colors"
            >
              ← Zurück
            </button>
            <button
              disabled={safePage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="px-3 py-1 rounded-md text-sm bg-surface-card text-slate-400 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-slate-700 transition-colors"
            >
              Weiter →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
