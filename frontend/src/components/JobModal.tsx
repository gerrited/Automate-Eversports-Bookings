import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Job, JobFormData } from '../types'
import { WEEKDAY_NAMES } from '../types'

interface Props {
  job?: Job
  onSave: (data: JobFormData) => void
  onClose: () => void
}

export default function JobModal({ job, onSave, onClose }: Props) {
  const [weekday, setWeekday] = useState(job?.weekday ?? 0)
  const [targetTime, setTargetTime] = useState(job?.target_time.slice(0, 5) ?? '18:00')
  const [facilityId, setFacilityId] = useState(job?.facility_id ?? '73041')
  const [className, setClassName] = useState(job?.class_name ?? 'CrossFit')
  const [daysInAdvance, setDaysInAdvance] = useState(job?.days_in_advance ?? 4)

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    onSave({
      weekday,
      target_time: targetTime,
      facility_id: facilityId,
      class_name: className,
      days_in_advance: Number(daysInAdvance),
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-slate-900 rounded-xl w-full max-w-md p-6">
        <h2 className="text-white font-bold text-lg mb-5">
          {job ? 'Job bearbeiten' : 'Neuen Job anlegen'}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1">
            <span className="text-slate-400 text-sm">Wochentag</span>
            <select
              aria-label="Wochentag"
              value={weekday}
              onChange={e => setWeekday(Number(e.target.value))}
              className="bg-slate-800 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
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
              className="bg-slate-800 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-slate-400 text-sm">Kursname</span>
            <input
              aria-label="Kursname"
              type="text"
              value={className}
              onChange={e => setClassName(e.target.value)}
              required
              className="bg-slate-800 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-slate-400 text-sm">Facility</span>
            <select
              aria-label="Facility"
              value={facilityId}
              onChange={e => setFacilityId(e.target.value)}
              className="bg-slate-800 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="73041">CrossFit Rabbithole</option>
              <option value="76012">Sport-Club Hundsmühlen e.V.</option>
            </select>
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
              className="bg-slate-800 text-white rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>

          <div className="flex gap-3 justify-end mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-semibold transition-colors"
            >
              Speichern
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
