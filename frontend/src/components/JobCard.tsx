import type { Job } from '../types'
import { WEEKDAY_NAMES } from '../types'

interface Props {
  job: Job
  onToggle: (id: string) => void
  onEdit: (job: Job) => void
  onDelete: (id: string) => void
  onSelect: (job: Job) => void
}

export default function JobCard({ job, onToggle, onEdit, onDelete, onSelect }: Props) {
  const time = job.target_time.slice(0, 5)  // "18:00"
  const facilityLabel = job.facility_name || job.facility_id

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
              {WEEKDAY_NAMES[job.weekday]} · {time} Uhr · {job.class_name}{job.one_time ? ' · Einmalig' : ''}
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {facilityLabel} · {job.days_in_advance} Tage im Voraus
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
          className="px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors"
        >
          Bearbeiten
        </button>
        <button
          aria-label="Löschen"
          onClick={() => onDelete(job.id)}
          className="px-3 py-1 rounded-md bg-red-900 hover:bg-red-700 text-red-300 text-sm transition-colors ml-auto"
        >
          Löschen
        </button>
      </div>
    </div>
  )
}
