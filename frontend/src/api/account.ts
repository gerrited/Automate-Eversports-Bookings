import { apiFetch } from './client'

export function deleteAccount(): Promise<void> {
  return apiFetch<void>('/account', { method: 'DELETE' })
}
