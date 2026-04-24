import { apiFetch } from './client'
import type { UserRecord } from '../types'

export async function listUsers(): Promise<UserRecord[]> {
  return apiFetch<UserRecord[]>('/api/admin/users')
}

export async function setUserActive(id: string, active: boolean): Promise<UserRecord> {
  return apiFetch<UserRecord>(`/api/admin/users/${id}/active`, {
    method: 'PATCH',
    body: JSON.stringify({ active }),
  })
}

export async function setUserLimit(id: string, max_active_jobs: number | null): Promise<UserRecord> {
  return apiFetch<UserRecord>(`/api/admin/users/${id}/limit`, {
    method: 'PATCH',
    body: JSON.stringify({ max_active_jobs }),
  })
}
