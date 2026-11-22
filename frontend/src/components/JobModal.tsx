import { useState, useEffect } from 'react'
import type { FormEvent } from 'react'
import type { Job, JobFormData, Facility } from '../types'
import FacilityCombobox from './FacilityCombobox'
import CourseCombobox from './CourseCombobox'
import HelpIcon from './HelpIcon'
import { getCourses } from '../api/facilities'
import { isAdmin } from '../api/client'
import { AlertMessage, Button, ModalShell, Stepper } from './ui'

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
  // Kursliste je (Anbieter, Wochentag, Uhrzeit) – Ladezustand wird daraus abgeleitet.
  const courseKey = facility ? `${facility.id}|${weekday}|${targetTime}` : null
  const [loadedCourses, setLoadedCourses] = useState<{ key: string; courses: string[] } | null>(null)
  const coursesReady = courseKey !== null && loadedCourses?.key === courseKey
  const courses = coursesReady ? loadedCourses.courses : []
  const isLoadingCourses = courseKey !== null && !coursesReady

  useEffect(() => {
    if (!facility) return
    const key = `${facility.id}|${weekday}|${targetTime}`
    let cancelled = false
    getCourses(facility.id, weekday, targetTime)
      .then(data => { if (!cancelled) setLoadedCourses({ key, courses: data }) })
      .catch(() => { if (!cancelled) setLoadedCourses({ key, courses: [] }) })
    return () => { cancelled = true }
  }, [facility, weekday, targetTime])

  // Ändert der Nutzer Anbieter, Tag oder Uhrzeit, passt der gewählte Kurs nicht mehr.
  function changeFacility(f: Facility) {
    if (f.id !== facility?.id) setClassName('')
    setFacility(f)
  }
  function changeWeekday(d: number) {
    if (d !== weekday) setClassName('')
    setWeekday(d)
  }
  function changeTargetTime(t: string) {
    if (t !== targetTime) setClassName('')
    setTargetTime(t)
  }

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

  const rowClass = 'flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-[14px] border border-[#15303a] bg-surface-row px-4 py-3'
  const labelClass = 'flex items-center gap-2 basis-[150px] shrink-0 text-[15px] font-semibold text-slate-200'
  const fieldClass = 'flex-[1_1_220px] min-w-0'
  const boxClass = 'flex items-center min-h-11 rounded-[10px] border border-line bg-surface-input px-3.5 transition-[border-color,box-shadow] focus-within:border-accent focus-within:shadow-[0_0_0_4px_rgba(46,184,166,.18)]'
  const segClass = (on: boolean) =>
    `flex-1 min-h-10 rounded-[9px] text-sm font-bold transition-colors ${on ? 'bg-brand text-white' : 'text-muted hover:text-white'}`

  return (
    <ModalShell>
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-2xl font-extrabold tracking-[-0.02em] text-white">
          {job ? 'Geplante Buchung bearbeiten' : 'Neue Buchung planen'}
        </h2>
        <button
          type="button"
          aria-label="Dialog schließen"
          onClick={onClose}
          className="shrink-0 w-11 h-11 rounded-xl flex items-center justify-center text-muted hover:bg-white/5 hover:text-white transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">

        <div className={rowClass}>
          <span className={labelClass}>Anbieter</span>
          <div className={`${fieldClass} ${boxClass}`}>
            <div className="flex-1 min-w-0">
              <FacilityCombobox value={facility} onChange={changeFacility} />
            </div>
          </div>
        </div>

        <div className={rowClass}>
          <span className={labelClass}>Wochentag</span>
          <div className={`${fieldClass} ${boxClass} px-0`}>
            <select
              aria-label="Wochentag"
              value={weekday}
              onChange={e => changeWeekday(Number(e.target.value))}
              className="w-full min-h-11 bg-transparent px-3 text-[15px] text-white outline-none [color-scheme:dark] [&>option]:bg-surface-input"
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
        </div>

        <div className={rowClass}>
          <span className={labelClass}>Uhrzeit</span>
          <div className={`${fieldClass} ${boxClass} px-0`}>
            <input
              aria-label="Uhrzeit"
              type="time"
              value={targetTime}
              onChange={e => changeTargetTime(e.target.value)}
              required
              className="w-full min-h-11 bg-transparent px-3 text-[15px] text-white outline-none [color-scheme:dark]"
            />
          </div>
        </div>

        <div className={rowClass}>
          <span className={labelClass}>Kursname</span>
          <div className={`${fieldClass} ${boxClass}`}>
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
        </div>

        <div className={rowClass}>
          <span className={`${labelClass} flex-col items-start gap-0.5`}>
            <span className="flex items-center gap-2">
              Durchführung
              <HelpIcon text="Wie viele Tage vor dem Kurs soll die Buchung ausgelöst werden? Eversports öffnet Buchungsslots typischerweise einige Tage im Voraus — stelle den Wert passend zum Anbieter ein." />
            </span>
            <span className="text-xs font-normal text-faint">Wann gebucht wird</span>
          </span>
          <div className={`${fieldClass} flex items-center gap-3`}>
            <Stepper
              aria-label="Tage im Voraus"
              value={daysInAdvance}
              onChange={setDaysInAdvance}
              min={1}
              max={30}
            />
            <span className="text-sm text-muted">Tage vorher</span>
          </div>
        </div>

        <div className={rowClass}>
          <span className={labelClass}>
            Häufigkeit
            <HelpIcon text="Einmalig: nur einmal ausführen, dann automatisch löschen. Wöchentlich: jede Woche wiederholen." />
          </span>
          <div role="group" aria-label="Häufigkeit" className={`${fieldClass} flex p-1 rounded-xl border border-line-strong bg-surface-input`}>
            <button type="button" aria-pressed={oneTime} onClick={() => setOneTime(true)} className={segClass(oneTime)}>
              Einmalig
            </button>
            <button type="button" aria-pressed={!oneTime} onClick={() => setOneTime(false)} className={segClass(!oneTime)}>
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
            <span className={`${fieldClass} flex items-center min-h-11`}>
              <input
                aria-label="Test"
                type="checkbox"
                checked={debug}
                onChange={e => setDebug(e.target.checked)}
                className="w-[22px] h-[22px] accent-accent"
              />
            </span>
          </div>
        )}

        {error && <AlertMessage type="error" className="rounded-xl border border-red-900 bg-red-900/20 px-4 py-3">{error}</AlertMessage>}

        <div className="flex flex-wrap justify-end gap-2.5 mt-2.5">
          <Button variant="outline" size="lg" onClick={onClose}>
            Abbrechen
          </Button>
          <Button variant="primary" size="lg" type="submit" disabled={!facility}>
            Speichern
          </Button>
        </div>
      </form>
    </ModalShell>
  )
}
