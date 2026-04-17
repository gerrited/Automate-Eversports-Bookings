import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import type { Job, JobFormData, Facility } from '../types'
import { WEEKDAY_NAMES } from '../types'
import FacilityCombobox from './FacilityCombobox'
import CourseCombobox from './CourseCombobox'
import { getCourses } from '../api/facilities'

interface Props {
  job?: Job
  onSave: (data: JobFormData) => Promise<void>
  onClose: () => void
  error?: string | null
}

export default function JobModal({ job, onSave, onClose, error }: Props) {
  const [weekday, setWeekday] = useState(job?.weekday ?? 0)
  const [targetTime, setTargetTime] = useState(job?.target_time.slice(0, 5) ?? '18:00')
  const [facility, setFacility] = useState<Facility | null>(
    job ? { id: job.facility_id, name: job.facility_name } : null
  )
  const [className, setClassName] = useState(job?.class_name ?? 'CrossFit')
  const [daysInAdvance, setDaysInAdvance] = useState(job?.days_in_advance ?? 4)
  const [oneTime, setOneTime] = useState(job?.one_time ?? false)
  const [courses, setCourses] = useState<string[]>([])

  useEffect(() => {
    if (!facility) {
      setCourses([])
      return
    }
    let cancelled = false
    getCourses(facility.id)
      .then(data => { if (!cancelled) setCourses(data) })
      .catch(() => { if (!cancelled) setCourses([]) })
    return () => { cancelled = true }
  }, [facility?.id])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await onSave({
      weekday,
      target_time: targetTime,
      facility_id: facility?.id ?? '',
      facility_name: facility?.name ?? '',
      class_name: className,
      days_in_advance: Number(daysInAdvance),
      one_time: oneTime,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-surface-card rounded-xl w-full max-w-md p-6">
        <h2 className="text-white font-bold text-lg mb-5">
          {job ? 'Routine bearbeiten' : 'Neue Routine anlegen'}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-slate-400 text-sm">Einrichtung</span>
            <FacilityCombobox value={facility} onChange={setFacility} />
          </div>

          <div className="flex flex-col gap-1">
            <span className="text-slate-400 text-sm">Kursname</span>
            <CourseCombobox
              value={className}
              onChange={setClassName}
              facilityCourses={courses}
            />
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-slate-400 text-sm">Wochentag</span>
            <select
              aria-label="Wochentag"
              value={weekday}
              onChange={e => setWeekday(Number(e.target.value))}
              className="bg-surface-input text-white rounded-lg px-3 py-2 outline-hidden focus:ring-2 focus:ring-brand"
            >
              {WEEKDAY_NAMES.map((name, i) => (
                <option key={i} value={i}>{name}</option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-slate-400 text-sm">Uhrzeit</span>
            <input
              aria-label="Uhrzeit"
              type="time"
              value={targetTime}
              onChange={e => setTargetTime(e.target.value)}
              required
              className="bg-surface-input text-white rounded-lg px-3 py-2 outline-hidden focus:ring-2 focus:ring-brand"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-slate-400 text-sm">Tage im Voraus</span>
            <input
              aria-label="Tage im Voraus"
              type="number"
              min={1}
              max={30}
              value={daysInAdvance}
              onChange={e => setDaysInAdvance(Number(e.target.value))}
              required
              className="bg-surface-input text-white rounded-lg px-3 py-2 outline-hidden focus:ring-2 focus:ring-brand"
            />
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              aria-label="Einmalig"
              type="checkbox"
              checked={oneTime}
              onChange={e => setOneTime(e.target.checked)}
              className="w-4 h-4 rounded accent-brand"
            />
            <span className="text-slate-300 text-sm">Einmalig</span>
          </label>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <div className="flex gap-3 justify-end mt-2">
            <button
              type="submit"
              className="px-4 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg font-semibold transition-colors disabled:opacity-50"
            >
              Speichern
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Abbrechen
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
