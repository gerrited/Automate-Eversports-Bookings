import { apiFetch } from './client'

export interface MeResponse {
  email: string
  role: string
  subscription_active: boolean
  total_bookings_executed: number
  max_active_jobs: number | null
}

export const getMe = (): Promise<MeResponse> =>
  apiFetch('/api/me')

export const createCheckoutSession = (): Promise<{ url: string }> =>
  apiFetch('/api/stripe/checkout', { method: 'POST' })
