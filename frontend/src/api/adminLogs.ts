import { apiFetch } from './client'
import type { AdminLogsPage } from '../types'

export const listAllLogs = (page: number, userEmail?: string): Promise<AdminLogsPage> => {
  const params = new URLSearchParams({ page: String(page) })
  if (userEmail) params.set('user_email', userEmail)
  return apiFetch(`/api/admin/logs?${params}`)
}
