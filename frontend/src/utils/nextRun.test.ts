import { formatClassDate, formatRunAt, nextRunPreview } from './nextRun'
import type { Job } from '../types'

const base: Job = {
  id: 'j', weekday: 4, target_time: '07:00:00', facility_id: '1', facility_name: 'X',
  class_name: 'Yoga', days_in_advance: 2, enabled: true, one_time: false, debug: false,
  created_at: '2026-11-01T00:00:00Z',
}

describe('nextRun', () => {
  it('formatiert den Lauf in Berliner Zeit (Winterzeit, UTC+1)', () => {
    expect(formatRunAt('2026-11-25T06:00:00Z')).toBe('Mi., 25.11. 07:00')
  })

  it('formatiert den Lauf in Berliner Zeit (Sommerzeit, UTC+2)', () => {
    expect(formatRunAt('2026-07-01T05:00:00Z')).toBe('Mi., 01.07. 07:00')
  })

  it('formatiert das Kursdatum ohne Zeitzonen-Verschiebung', () => {
    expect(formatClassDate('2026-11-27')).toBe('Fr., 27.11.')
  })

  it('zeigt Lauf und Kurstermin', () => {
    expect(nextRunPreview({ ...base, next_run_at: '2026-11-25T06:00:00Z', next_class_date: '2026-11-27' }))
      .toBe('Bucht Mi., 25.11. 07:00 Uhr für den Kurs am Fr., 27.11.')
  })

  it('zeigt Hinweis bei pausiertem Job', () => {
    expect(nextRunPreview({ ...base, enabled: false, next_run_at: '2026-11-25T06:00:00Z', next_class_date: '2026-11-27' }))
      .toBe('Keine Buchung geplant')
  })

  it('zeigt Hinweis, wenn noch nicht eingeplant', () => {
    expect(nextRunPreview({ ...base, next_run_at: null })).toMatch(/nächsten Worker-Lauf/)
  })
})
