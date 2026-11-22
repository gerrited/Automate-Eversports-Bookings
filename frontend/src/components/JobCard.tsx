import { useState, useEffect, useRef } from 'react'
import type { Job } from '../types'
import { WEEKDAY_NAMES } from '../types'
import { Button } from './ui'

interface Props {
  job: Job
  onToggle: (id: string) => Promise<void>
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
  const [toggling, setToggling] = useState(false)
  const [feedback, setFeedback] = useState<{ status: string; message: string } | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  async function handleExecute() {
    if (!onExecute || executing) return
    setExecuting(true)
    setFeedback(null)
    try {
      const result = await onExecute(job.id)
      setFeedback(result)
    } catch {
      setFeedback({ status: 'failed', message: 'Unbekannter Fehler' })
    } finally {
      setExecuting(false)
      timerRef.current = setTimeout(() => setFeedback(null), 10000)
    }
  }

  async function handleToggle() {
    if (toggling) return
    setToggling(true)
    try {
      await onToggle(job.id)
    } catch (err) {
      if (timerRef.current) clearTimeout(timerRef.current)
      setFeedback({ status: 'failed', message: err instanceof Error ? err.message : 'Fehler beim Umschalten' })
      timerRef.current = setTimeout(() => setFeedback(null), 10000)
    } finally {
      setToggling(false)
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

  const abbr = WEEKDAY_NAMES[job.weekday].slice(0, 2).toUpperCase()
  const active = job.enabled

  return (
    <article className="flex flex-col rounded-[20px] border border-[#15303a] bg-surface-card transition-colors hover:border-[#24464d] overflow-hidden">
      {/* Clickable body */}
      <div
        data-testid="job-card-body"
        className="p-4 sm:p-[22px] sm:pb-5 cursor-pointer"
        onClick={() => onSelect(job)}
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <div className={`flex items-start gap-3 sm:gap-4 flex-1 min-w-0 transition-opacity ${active ? '' : 'opacity-60'}`}>
            <span
              aria-hidden="true"
              className={`shrink-0 w-[62px] h-[62px] rounded-2xl flex flex-col items-center justify-center gap-0.5 ${active ? 'bg-brand' : 'bg-slate-800'}`}
            >
              <span className={`text-xs font-extrabold tracking-[0.08em] ${active ? 'text-accent' : 'text-muted'}`}>{abbr}</span>
              <span className="text-[15px] font-extrabold tabular-nums text-white">{time}</span>
            </span>
            <span className="flex-1 min-w-0 flex flex-col gap-[5px]">
              <span className="text-[17px] sm:text-lg font-extrabold text-white break-words">
                {WEEKDAY_NAMES[job.weekday]} · {time} Uhr · {job.class_name}
              </span>
              <span className="text-sm leading-snug text-muted break-words">
                {facilityLabel} · {job.days_in_advance} {job.days_in_advance === 1 ? 'Tag' : 'Tage'} im Voraus · {job.one_time ? 'Einmalig' : 'Wöchentlich'}
              </span>
              <span className="mt-1 flex flex-wrap gap-1.5">
                <span className={`rounded-full px-2.5 py-[3px] text-xs font-bold ${active ? 'bg-accent/15 text-accent-hover' : 'bg-slate-400/15 text-slate-300'}`}>
                  {active ? 'Aktiv' : 'Pausiert'}
                </span>
                {job.debug && (
                  <span className="rounded-full bg-amber-400/15 px-2.5 py-[3px] text-xs font-bold text-amber-300">Test</span>
                )}
              </span>
            </span>
          </div>
          {/* Toggle */}
          <button
            role="switch"
            aria-checked={job.enabled}
            aria-label={`${WEEKDAY_NAMES[job.weekday]} ${time} Uhr ${job.class_name} automatisch buchen`}
            disabled={toggling}
            onClick={e => { e.stopPropagation(); handleToggle() }}
            className={`relative shrink-0 mt-1 w-[52px] h-[30px] rounded-full transition-colors disabled:opacity-70 ${
              active ? 'bg-green-600' : 'bg-slate-700'
            }`}
          >
            <span
              className={`absolute top-1 left-1 w-[22px] h-[22px] rounded-full bg-white shadow-[0_2px_6px_rgba(0,0,0,.3)] transition-transform duration-200 ${
                active ? 'translate-x-[22px]' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Action bar */}
      <div className="mx-4 sm:mx-[22px] flex flex-wrap items-center gap-2 sm:gap-2.5 border-t border-line-subtle py-4">
        <Button
          variant="slate"
          aria-label="Bearbeiten"
          onClick={() => onEdit(job)}
          disabled={executing}
        >
          Bearbeiten
        </Button>
        {onExecute && (
          <Button
            variant="primary"
            aria-label="Jetzt buchen"
            onClick={handleExecute}
            loading={executing}
          >
            {executing ? 'Bucht…' : 'Jetzt buchen'}
          </Button>
        )}
        <div className="ml-auto">
          <Button
            variant="danger"
            aria-label="Löschen"
            onClick={() => onDelete(job.id)}
            disabled={executing}
          >
            Löschen
          </Button>
        </div>
      </div>

      {/* Feedback */}
      {feedback && (
        <div role="status" className={`mx-4 sm:mx-[22px] mb-4 -mt-1 text-sm font-medium ${feedbackClass}`}>
          {feedbackText}
        </div>
      )}
    </article>
  )
}
