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
  debug: boolean
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
  debug?: boolean
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

export interface AdminJob extends Job {
  user_email: string
  success_count: number
  failed_count: number
  already_booked_count: number
}

export interface BookedAppointment {
  activity_name: string
  facility_name: string
  facility_slug: string
  start_datetime: string
  end_datetime: string
  address: string
  event_id: string
  event_participant_id: string
  session_id: string
  facility_id: string
}
