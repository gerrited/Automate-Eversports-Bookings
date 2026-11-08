import { apiFetch } from './client'

export interface CalendarTokenResponse {
  token: string
}

export const getCalendarToken = (): Promise<CalendarTokenResponse> =>
  apiFetch('/api/me/calendar-token')

export const regenerateCalendarToken = (): Promise<CalendarTokenResponse> =>
  apiFetch('/api/me/calendar-token/regenerate', { method: 'POST' })
