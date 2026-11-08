import { apiFetch } from './client'

export const createCheckoutSession = (): Promise<{ url: string }> =>
  apiFetch('/api/stripe/checkout', { method: 'POST' })
