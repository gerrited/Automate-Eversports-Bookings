import { apiFetch } from './client'

export function deleteAccount(): Promise<void> {
  return apiFetch<void>('/api/account', { method: 'DELETE' })
}
