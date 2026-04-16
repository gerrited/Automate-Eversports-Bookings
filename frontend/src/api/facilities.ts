import { apiFetch } from './client'
import type { Facility } from '../types'

export const getRecentFacilities = (): Promise<Facility[]> =>
  apiFetch('/api/facilities/recent')

export const searchFacilities = (q: string): Promise<Facility[]> =>
  apiFetch(`/api/facilities/search?q=${encodeURIComponent(q)}`)

export const getCourses = (facilityId: string): Promise<string[]> =>
  apiFetch(`/api/facilities/${encodeURIComponent(facilityId)}/courses`)
