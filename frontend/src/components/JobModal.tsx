import { useState, useEffect, useRef } from 'react'
import type { FormEvent } from 'react'
import type { Job, JobFormData, Facility } from '../types'
import FacilityCombobox from './FacilityCombobox'
import CourseCombobox from './CourseCombobox'
import HelpIcon from './HelpIcon'
import { getCourses } from '../api/facilities'
import { isAdmin } from '../api/client'
import { Button, ModalShell, WeekdaySelector, Stepper } from './ui'

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

  const rowClass = 'flex items-center gap-3 bg-surface-input rounded-lg px-3 py-2'
  const labelClass = 'flex items-center gap-1 text-slate-500 text-xs w-20 shrink-0'

  return (
    <ModalShell>
      <h2 className="text-white font-bold text-lg mb-4">
        {job ? 'Geplante Buchung bearbeiten' : 'Neue Buchung planen'}
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-2">

        <div className="flex items-center gap-3 py-1">
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
          <WeekdaySelector value={weekday} onChange={setWeekday} />
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
            className="bg-surface-input text-white rounded-lg px-3 py-2 outline-hidden focus:ring-2 focus:ring-brand [color-scheme:dark]"
          />
        </div>

        <div className="flex items-center gap-3 py-1">
          <span className={labelClass}>
            Kursname
            <HelpIcon text="Der Name des Kurses, der gebucht werden soll. Leer lassen, um den ersten verfügbaren Kurs zu diesem Zeitpunkt zu buchen." />
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
            Tage im Voraus
            <HelpIcon text="Wie viele Tage vor dem Kurs soll die Buchung ausgelöst werden? Eversports öffnet Buchungsslots typischerweise einige Tage im Voraus — stelle den Wert passend zum Anbieter ein." />
          </span>
          <Stepper
            aria-label="Tage im Voraus"
            value={daysInAdvance}
            onChange={setDaysInAdvance}
            min={1}
            max={30}
          />
        </div>

        <div className={rowClass}>
          <span className={labelClass}>
            Einmalig
            <HelpIcon text="Aktiviert: nur einmal ausführen, dann automatisch löschen. Deaktiviert: jede Woche wiederholen." />
          </span>
          <input
            aria-label="Einmalig"
            type="checkbox"
            checked={oneTime}
            onChange={e => setOneTime(e.target.checked)}
            className="w-4 h-4 rounded accent-brand"
          />
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
