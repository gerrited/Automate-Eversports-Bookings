import { useEffect, useState } from 'react'
import { getWorkerStatus } from '../api/workerStatus'
import type { WorkerStatus } from '../api/workerStatus'

function formatBerlin(iso: string): string {
  return new Date(iso).toLocaleString('de-DE', {
    timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
}

/** Admin: Lebenszeichen des Booking-Workers (letzter Lauf, Ausfall-Warnung). */
export default function WorkerStatusCard() {
  const [status, setStatus] = useState<WorkerStatus | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const s = await getWorkerStatus()
        if (!cancelled) setStatus(s)
      } catch {
        if (!cancelled) setError(true)
      }
    })()
    return () => { cancelled = true }
  }, [])

  if (error) {
    return (
      <div role="status" className="mb-4 rounded-xl bg-surface-card px-4 py-3 text-sm text-muted">
        Worker-Status konnte nicht geladen werden.
      </div>
    )
  }
  if (!status) return null

  let tone: 'ok' | 'stale' | 'unknown'
  let headline: string
  if (!status.last_started_at) {
    tone = 'unknown'
    headline = 'Worker ist noch nie gelaufen'
  } else if (status.stale) {
    tone = 'stale'
    headline = `Worker reagiert nicht – seit über ${status.stale_after_minutes} Minuten kein Lauf`
  } else {
    tone = 'ok'
    headline = 'Worker läuft'
  }

  const styles = {
    ok: 'border-green-500/30 text-green-300',
    stale: 'border-red-500/50 text-red-300',
    unknown: 'border-slate-500/40 text-slate-300',
  }[tone]
  const dot = { ok: 'bg-green-400', stale: 'bg-red-400', unknown: 'bg-slate-400' }[tone]

  return (
    <section
      role={tone === 'stale' ? 'alert' : 'status'}
      aria-label="Worker-Status"
      className={`mb-4 rounded-xl border bg-surface-card px-4 py-3 ${styles}`}
    >
      <p className="flex items-center gap-2 text-sm font-bold">
        <span aria-hidden="true" className={`inline-block h-2.5 w-2.5 rounded-full ${dot}`} />
        {headline}
      </p>
      {status.last_started_at && (
        <p className="mt-1 text-xs text-muted">
          Letzter Start: {formatBerlin(status.last_started_at)} Uhr
          {status.last_finished_at && ` · Letztes Ende: ${formatBerlin(status.last_finished_at)} Uhr`}
          {status.last_job_count !== null && ` · ${status.last_job_count} Job${status.last_job_count === 1 ? '' : 's'} im letzten Lauf`}
          {status.alert_sent_at && ' · Admins per E-Mail benachrichtigt'}
        </p>
      )}
    </section>
  )
}
