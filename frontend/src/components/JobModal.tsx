import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import type { Job, JobFormData, Facility } from '../types'
import FacilityCombobox from './FacilityCombobox'
import CourseCombobox from './CourseCombobox'
import HelpIcon from './HelpIcon'
import { getCourses } from '../api/facilities'
import { isAdmin } from '../api/client'
import { Button, ModalShell, Stepper } from './ui'

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
  const [isLoadingCourses, setIsLoadingCourses] = useState(false)

  const isInitialMount = useRef(true)

  useEffect(() => {
    if (!facility) {
      setCourses([])
      setIsLoadingCourses(false)
      return
    }
    let cancelled = false
    setCourses([])
    setIsLoadingCourses(true)
    getCourses(facility.id, weekday, targetTime)
      .then(data => { if (!cancelled) { setCourses(data); setIsLoadingCourses(false) } })
      .catch(() => { if (!cancelled) { setCourses([]); setIsLoadingCourses(false) } })
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

  const rowClass = 'flex items-center gap-3 bg-surface-input border border-slate-700 rounded-lg px-3 min-h-[44px]'
  const labelClass = 'flex items-center gap-2 text-white text-xs w-28 shrink-0'

  return (
    <ModalShell>
      <h2 className="text-white font-bold text-lg mb-4">
        {job ? 'Geplante Buchung bearbeiten' : 'Neue Buchung planen'}
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">

        <div className={rowClass}>
          <span className={labelClass}>
            Anbieter
            <HelpIcon text="Der Sportanbieter, bei dem du den Kurs buchen möchtest." />
          </span>
          <div className="flex-1 min-w-0">
            <FacilityCombobox value={facility} onChange={setFacility} />
          </div>
        </div>

        <div className={rowClass}>
          <span className={labelClass}>
            Wochentag
            <HelpIcon text="Der Wochentag, an dem der Kurs regelmäßig stattfindet." />
          </span>
          <select
            aria-label="Wochentag"
            value={weekday}
            onChange={e => setWeekday(Number(e.target.value))}
            className="bg-transparent text-white text-sm flex-1 outline-hidden focus:ring-2 focus:ring-brand rounded [color-scheme:dark]"
          >
            <option value={0}>Montag</option>
            <option value={1}>Dienstag</option>
            <option value={2}>Mittwoch</option>
            <option value={3}>Donnerstag</option>
            <option value={4}>Freitag</option>
            <option value={5}>Samstag</option>
            <option value={6}>Sonntag</option>
          </select>
        </div>

        <div className={rowClass}>
          <span className={labelClass}>
            Uhrzeit
            <HelpIcon text="Die Startzeit des Kurses. Wird auch genutzt, um passende Kurse in der Auswahl zu filtern." />
          </span>
          <input
            aria-label="Uhrzeit"
            type="time"
            value={targetTime}
            onChange={e => setTargetTime(e.target.value)}
            required
            className="bg-transparent text-white text-sm outline-hidden [color-scheme:dark]"
          />
        </div>

        <div className={rowClass}>
          <span className={labelClass}>
            Kursname
            <HelpIcon text="Der Name des Kurses, der gebucht werden soll." />
          </span>
          <div className="flex-1 min-w-0">
            <CourseCombobox
              value={className}
              onChange={setClassName}
              facilityCourses={courses}
              isLoading={isLoadingCourses}
              canSearch={!!facility}
            />
          </div>
        </div>

        <div className={rowClass}>
          <span className={labelClass}>
            Durchführung
            <HelpIcon text="Wie viele Tage vor dem Kurs soll die Buchung ausgelöst werden? Eversports öffnet Buchungsslots typischerweise einige Tage im Voraus — stelle den Wert passend zum Anbieter ein." />
          </span>
          <div className="flex items-center gap-2">
            <Stepper
              aria-label="Tage im Voraus"
              value={daysInAdvance}
              onChange={setDaysInAdvance}
              min={1}
              max={30}
            />
            <span className="text-slate-500 text-xs">Tage vorher</span>
          </div>
        </div>

        <div className={rowClass}>
          <span className={labelClass}>
            Häufigkeit
            <HelpIcon text="Einmalig: nur einmal ausführen, dann automatisch löschen. Wöchentlich: jede Woche wiederholen." />
          </span>
          <div role="group" aria-label="Häufigkeit" className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              aria-pressed={oneTime}
              onClick={() => setOneTime(true)}
              className={`px-3 h-[30px] text-xs font-semibold rounded-l-md border border-r-0 transition-colors ${oneTime ? 'bg-brand text-white border-brand' : 'bg-surface-card text-slate-500 border-slate-700'}`}
            >
              Einmalig
            </button>
            <button
              type="button"
              aria-pressed={!oneTime}
              onClick={() => setOneTime(false)}
              className={`px-3 h-[30px] text-xs font-semibold rounded-r-md border transition-colors ${!oneTime ? 'bg-brand text-white border-brand' : 'bg-surface-card text-slate-500 border-slate-700'}`}
            >
              Wöchentlich
            </button>
          </div>
        </div>

        {isAdmin() && (
          <div className={rowClass}>
            <span className={labelClass}>
              Test
              <HelpIcon text="Testmodus — die Buchung wird sofort nach Abschluss wieder storniert." />
            </span>
            <input
              aria-label="Test"
              type="checkbox"
              checked={debug}
              onChange={e => setDebug(e.target.checked)}
              className="w-4 h-4 rounded accent-brand"
            />
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <div className="flex gap-3 justify-end mt-2">
          <Button variant="primary" type="submit" disabled={!facility}>
            Speichern
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
        </div>
      </form>
    </ModalShell>
  )
}
