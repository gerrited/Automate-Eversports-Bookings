import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import type { Job, JobFormData, Facility } from '../types'
import { WEEKDAY_NAMES } from '../types'
import FacilityCombobox from './FacilityCombobox'
import CourseCombobox from './CourseCombobox'
import HelpIcon from './HelpIcon'
import { getCourses } from '../api/facilities'
import { isAdmin } from '../api/client'

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
  const [className, setClassName] = useState(job?.class_name ?? '')
  const [daysInAdvance, setDaysInAdvance] = useState(job?.days_in_advance ?? 4)
  const [oneTime, setOneTime] = useState(job?.one_time ?? false)
  const [debug, setDebug] = useState(job?.debug ?? false)
  const [courses, setCourses] = useState<string[]>([])

  const isInitialMount = useRef(true)

  useEffect(() => {
    if (!facility) {
      setCourses([])
      return
    }
    let cancelled = false
    getCourses(facility.id, weekday, targetTime)
      .then(data => { if (!cancelled) setCourses(data) })
      .catch(() => { if (!cancelled) setCourses([]) })
    if (!isInitialMount.current) setClassName('')
    isInitialMount.current = false
    return () => { cancelled = true }
  }, [facility?.id, weekday, targetTime])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!facility) return
    await onSave({
      weekday,
      target_time: targetTime,
      facility_id: facility.id,
      facility_name: facility.name,
      class_name: className,
      days_in_advance: Number(daysInAdvance),
      one_time: oneTime,
      ...(isAdmin() ? { debug } : {}),
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-surface-card rounded-xl w-full max-w-md p-6">
        <h2 className="text-white font-bold text-lg mb-5">
          {job ? 'Geplante Buchung bearbeiten' : 'Neue Buchung planen'}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-slate-400 text-sm">
              Anbieter
              <HelpIcon text="Der Sportanbieter, bei dem du den Kurs buchen möchtest." />
            </span>
            <FacilityCombobox value={facility} onChange={setFacility} />
          </div>

          <label className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-slate-400 text-sm">
              Wochentag
              <HelpIcon text="Der Wochentag, an dem der Kurs regelmäßig stattfindet." />
            </span>
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
            <span className="flex items-center gap-1.5 text-slate-400 text-sm">
              Uhrzeit
              <HelpIcon text="Die Startzeit des Kurses. Wird auch genutzt, um passende Kurse in der Auswahl zu filtern." />
            </span>
            <input
              aria-label="Uhrzeit"
              type="time"
              value={targetTime}
              onChange={e => setTargetTime(e.target.value)}
              required
              className="bg-surface-input text-white rounded-lg px-3 py-2 outline-hidden focus:ring-2 focus:ring-brand [color-scheme:dark]"
            />
          </label>

          <div className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-slate-400 text-sm">
              Kursname
              <HelpIcon text="Der Name des Kurses, der gebucht werden soll. Leer lassen, um den ersten verfügbaren Kurs zu diesem Zeitpunkt zu buchen." />
            </span>
            <CourseCombobox
              value={className}
              onChange={setClassName}
              facilityCourses={courses}
            />
          </div>

          <label className="flex flex-col gap-1">
            <span className="flex items-center gap-1.5 text-slate-400 text-sm">
              Tage im Voraus
              <HelpIcon text="Wie viele Tage vor dem Kurs soll die Buchung ausgelöst werden? Eversports öffnet Buchungsslots typischerweise einige Tage im Voraus — stelle den Wert passend zum Anbieter ein." />
            </span>
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
            <span className="flex items-center gap-1.5 text-slate-300 text-sm">
              Einmalig
              <HelpIcon text="Aktiviert: nur einmal ausführen, dann automatisch löschen. Deaktiviert: jede Woche wiederholen." />
            </span>
          </label>

          {isAdmin() && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                aria-label="Debug"
                type="checkbox"
                checked={debug}
                onChange={e => setDebug(e.target.checked)}
                className="w-4 h-4 rounded accent-brand"
              />
              <span className="flex items-center gap-1.5 text-slate-300 text-sm">
                Test
                <HelpIcon text="Testmodus — die Buchung wird sofort nach Abschluss wieder storniert." />
              </span>
            </label>
          )}

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <div className="flex gap-3 justify-end mt-2">
            <button
              type="submit"
              disabled={!facility}
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
