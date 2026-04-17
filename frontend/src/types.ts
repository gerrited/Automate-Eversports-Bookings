export interface Job {
  id: string
  weekday: number        // 0=Mon … 6=Sun
  target_time: string   // "HH:MM:SS"
  facility_id: string
  facility_name: string
  class_name: string
  days_in_advance: number
  enabled: boolean
  one_time: boolean
  created_at: string
}

export interface JobFormData {
  weekday: number
  target_time: string   // "HH:MM"
  facility_id: string
  facility_name: string
  class_name: string
  days_in_advance: number
  one_time: boolean
}

export interface Facility {
  id: string
  name: string
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

export interface UserRecord {
  id: string
  email: string
  active: boolean
  role: string
  job_count: number
  created_at: string
}
