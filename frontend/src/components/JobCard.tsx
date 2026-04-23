import { useState, useEffect, useRef } from 'react'
import type { Job } from '../types'
import { WEEKDAY_NAMES } from '../types'

interface Props {
  job: Job
  onToggle: (id: string) => void
  onEdit: (job: Job) => void
  onDelete: (id: string) => void
  onSelect: (job: Job) => void
  onExecute?: (id: string) => Promise<{ status: string; message: string }>
}

function nextWeekdayDate(weekday: number): Date {
  // weekday: 0=Mo … 6=So (wie Python), JS getDay(): 0=So … 6=Sa
  const today = new Date()
  const daysAhead = (weekday + 1 - today.getDay() + 7) % 7
  const d = new Date(today)
  d.setDate(today.getDate() + daysAhead)
  return d
}

export default function JobCard({ job, onToggle, onEdit, onDelete, onSelect, onExecute }: Props) {
  const time = job.target_time.slice(0, 5)
  const facilityLabel = job.facility_name || job.facility_id

  const [executing, setExecuting] = useState(false)
  const [feedback, setFeedback] = useState<{ status: string; message: string } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  async function handleExecute() {
    if (!onExecute || executing) return
    setExecuting(true)
    setFeedback(null)
    try {
      const result = await onExecute(job.id)
      if (mountedRef.current) setFeedback(result)
    } catch {
      if (mountedRef.current) setFeedback({ status: 'failed', message: 'Unbekannter Fehler' })
    } finally {
      if (mountedRef.current) {
        setExecuting(false)
        timerRef.current = setTimeout(() => setFeedback(null), 4000)
      }
    }
  }

  const targetDate = nextWeekdayDate(job.weekday)
  const dateLabel = targetDate.toLocaleDateString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric',
  })

  let feedbackText = ''
  let feedbackClass = ''
  if (feedback) {
    if (feedback.status === 'success') {
      feedbackText = `✓ Erfolgreich gebucht für ${dateLabel}`
      feedbackClass = 'text-green-400'
    } else if (feedback.status === 'already_booked') {
      feedbackText = `ℹ Bereits gebucht für ${dateLabel}`
      feedbackClass = 'text-blue-400'
    } else {
      feedbackText = `✕ ${feedback.message}`
      feedbackClass = 'text-red-400'
    }
  }

  return (
    <div className="bg-surface-card rounded-xl overflow-hidden">
      {/* Clickable body */}
      <div
        data-testid="job-card-body"
        className="p-4 cursor-pointer hover:bg-surface-input transition-colors"
        onClick={() => onSelect(job)}
      >
        <div className="flex justify-between items-start">
          <div>
            <p className="text-white font-semibold">
              {WEEKDAY_NAMES[job.weekday]} · {time} Uhr · {job.class_name}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {facilityLabel} · {job.days_in_advance} Tage im Voraus{job.one_time ? ' · Einmalig' : ''}{job.debug ? ' · ' : ''}{job.debug && <span className="text-amber-400 text-xs font-medium">Test</span>}
            </p>
          </div>
          {/* Toggle */}
          <button
            role="switch"
            aria-checked={job.enabled}
            onClick={e => { e.stopPropagation(); onToggle(job.id) }}
            className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
              job.enabled ? 'bg-green-700' : 'bg-slate-600'
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-1 ${
                job.enabled ? 'translate-x-6' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center gap-2 px-4 pb-3 pt-3">
        <button
          aria-label="Bearbeiten"
          onClick={() => onEdit(job)}
          disabled={executing}
          className="px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors disabled:opacity-50"
        >
          Bearbeiten
        </button>
        {onExecute && (
          <button
            aria-label="Jetzt buchen"
            onClick={handleExecute}
            disabled={executing}
            className="px-3 py-1 rounded-md bg-blue-700 hover:bg-blue-600 text-white text-sm transition-colors disabled:opacity-60 flex items-center gap-1"
          >
            {executing ? (
              <>
                <span className="inline-block h-3 w-3 rounded-full border-2 border-blue-300 border-t-transparent animate-spin" />
                Bucht…
              </>
            ) : 'Jetzt buchen'}
          </button>
        )}
        <button
          aria-label="Löschen"
          onClick={() => onDelete(job.id)}
          disabled={executing}
          className="px-3 py-1 rounded-md bg-red-900 hover:bg-red-700 text-red-300 text-sm transition-colors ml-auto disabled:opacity-50"
        >
          Löschen
        </button>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`px-4 pb-3 text-sm font-medium ${feedbackClass}`}>
          {feedbackText}
        </div>
      )}
    </div>
  )
}
