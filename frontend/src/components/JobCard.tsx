import type { Job } from '../types'
import { WEEKDAY_NAMES, FACILITIES } from '../types'

interface Props {
  job: Job
  onToggle: (id: string) => void
  onEdit: (job: Job) => void
  onDelete: (id: string) => void
  onSelect: (job: Job) => void
}

export default function JobCard({ job, onToggle, onEdit, onDelete, onSelect }: Props) {
  const time = job.target_time.slice(0, 5)  // "18:00"

  return (
    <div className="bg-[#03191b] rounded-xl overflow-hidden">
      {/* Clickable body */}
      <div
        data-testid="job-card-body"
        className="p-4 cursor-pointer hover:bg-[#052528] transition-colors"
        onClick={() => onSelect(job)}
      >
        <div className="flex justify-between items-start">
          <div>
            <p className="text-white font-semibold">
              {WEEKDAY_NAMES[job.weekday]} · {time} · <span>{job.class_name}</span>
            </p>
            <p className="text-slate-400 text-sm mt-1">
              {FACILITIES.find(f => f.id === job.facility_id)?.name ?? job.facility_id} · {job.days_in_advance} Tage vorher
            </p>
          </div>
          {/* Toggle */}
          <button
            role="switch"
            aria-checked={job.enabled}
            onClick={e => { e.stopPropagation(); onToggle(job.id) }}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full transition-colors ${
              job.enabled ? 'bg-green-500' : 'bg-slate-600'
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
      <div className="flex gap-2 px-4 pb-3">
        <button
          aria-label="Bearbeiten"
          onClick={() => onEdit(job)}
          className="text-slate-400 hover:text-indigo-400 text-sm transition-colors"
        >
          ✏ Bearbeiten
        </button>
        <button
          aria-label="Löschen"
          onClick={() => onDelete(job.id)}
          className="text-slate-400 hover:text-red-400 text-sm transition-colors ml-auto"
        >
          🗑 Löschen
        </button>
      </div>
    </div>
  )
}
