import { apiFetch } from './client'
import type { Facility } from '../types'

export const getRecentFacilities = (): Promise<Facility[]> =>
  apiFetch('/api/facilities/recent')

export const searchFacilities = (q: string): Promise<Facility[]> =>
  apiFetch(`/api/facilities/search?q=${encodeURIComponent(q)}`)

export const getCourses = (
  facilityId: string,
  weekday?: number,
  targetTime?: string,
): Promise<string[]> => {
  const params = new URLSearchParams()
  if (weekday !== undefined) params.set('weekday', String(weekday))
  if (targetTime) params.set('target_time', targetTime)
  const qs = params.toString() ? `?${params}` : ''
  return apiFetch(`/api/facilities/${encodeURIComponent(facilityId)}/courses${qs}`)
}

export const getRecentCourses = (): Promise<string[]> =>
  apiFetch('/api/courses/recent')
