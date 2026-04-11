export interface Job {
  id: string
  weekday: number        // 0=Mon … 6=Sun
  target_time: string   // "HH:MM:SS"
  facility_id: string
  class_name: string
  days_in_advance: number
  enabled: boolean
  created_at: string
}

export interface JobFormData {
  weekday: number
  target_time: string   // "HH:MM"
  facility_id: string
  class_name: string
  days_in_advance: number
}

export interface BookingLog {
  id: string
  job_id: string
  executed_at: string
  target_date: string
  status: 'success' | 'failed' | 'already_booked'
  message: string | null
}

export const WEEKDAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag']

export const FACILITIES: { id: string; name: string }[] = [
  { id: '73041', name: 'CrossFit Rabbithole' },
  { id: '76012', name: 'Sport-Club Hundsmühlen e.V.' },
]
