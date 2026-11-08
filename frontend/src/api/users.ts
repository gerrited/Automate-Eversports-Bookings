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

export async function sendUserMessage(id: string, subject: string, content: string): Promise<void> {
  await apiFetch<{ detail: string }>(`/api/admin/users/${id}/message`, {
    method: 'POST',
    body: JSON.stringify({ subject, content }),
  })
}

export async function sendTestPush(userId: string): Promise<void> {
  await apiFetch(`/api/admin/users/${userId}/push-test`, { method: 'POST' })
}
