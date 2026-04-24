import { apiFetch } from './client'
import type { CurrentUser } from '../types'

export function deleteAccount(): Promise<void> {
  return apiFetch<void>('/api/account', { method: 'DELETE' })
}

export function getMe(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>('/api/me')
}
