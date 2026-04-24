import { apiFetch } from './client'
import type { BookedAppointment } from '../types'

export const getUpcomingBookings = (): Promise<BookedAppointment[]> =>
  apiFetch('/api/bookings/upcoming')

export const cancelBooking = (
  eventParticipantId: string,
  body: { event_id: string; facility_id: string; session_id: string },
): Promise<void> =>
  apiFetch(`/api/bookings/${eventParticipantId}/cancel`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
