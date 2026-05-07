import { useState, useEffect, useCallback } from 'react'
import { listAllJobs } from '../api/adminJobs'
import { WEEKDAY_NAMES } from '../types'
import type { AdminJob } from '../types'
import { Button, Input } from './ui'

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
          <Input
            variant="filter"
            type="text"
            value={emailFilter}
            onChange={e => handleFilterChange(e.target.value)}
            placeholder="Nach E-Mail filtern…"
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
                    {job.facility_name} · {job.days_in_advance} Tage im Voraus{job.one_time ? ' · Einmalig' : ''}{job.debug ? ' · ' : ''}{job.debug && <span className="text-amber-400 font-medium">Test</span>}
                  </p>
                </div>
                {(() => {
                  const total = job.success_count + job.failed_count + job.already_booked_count
                  if (total === 0) return (
                    <span className="ml-3 shrink-0 text-slate-500 text-xs whitespace-nowrap">
                      Noch nicht ausgeführt
                    </span>
                  )
                  const successPct = (job.success_count / total) * 100
                  const failedPct = (job.failed_count / total) * 100
                  const bookedPct = (job.already_booked_count / total) * 100
                  return (
                    <div className="ml-3 shrink-0 w-28">
                      <div className="flex gap-1.5 mb-1">
                        {job.success_count > 0 && (
                          <span className="text-green-400 text-xs">✓ {job.success_count}</span>
                        )}
                        {job.failed_count > 0 && (
                          <span className="text-red-400 text-xs">✗ {job.failed_count}</span>
                        )}
                        {job.already_booked_count > 0 && (
                          <span className="text-slate-400 text-xs">⊘ {job.already_booked_count}</span>
                        )}
                      </div>
                      <div className="flex h-1.5 rounded-full overflow-hidden bg-slate-700">
                        {job.success_count > 0 && (
                          <div className="bg-green-400" style={{ width: `${successPct}%` }} />
                        )}
                        {job.failed_count > 0 && (
                          <div className="bg-red-400" style={{ width: `${failedPct}%` }} />
                        )}
                        {job.already_booked_count > 0 && (
                          <div className="bg-slate-500" style={{ width: `${bookedPct}%` }} />
                        )}
                      </div>
                      <div className="text-slate-500 text-xs mt-1 text-right">{total}× gesamt</div>
                    </div>
                  )
                })()}
              </div>
            )
          })}
          <div className="flex items-center justify-center gap-3 mt-2">
            <Button variant="secondary" size="sm" disabled={safePage === 1} onClick={() => setCurrentPage(p => p - 1)}>
              ← Zurück
            </Button>
            <Button variant="secondary" size="sm" disabled={safePage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              Weiter →
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
