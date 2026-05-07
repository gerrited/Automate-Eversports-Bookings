import { apiFetch } from './client'

export function getVapidPublicKey(): Promise<{ public_key: string }> {
  return apiFetch<{ public_key: string }>('/api/push/vapid-public-key')
}

export function registerSubscription(sub: {
  endpoint: string
  p256dh: string
  auth: string
}): Promise<void> {
  return apiFetch<void>('/api/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(sub),
  })
}

export function unregisterSubscription(endpoint: string): Promise<void> {
  return apiFetch<void>('/api/push/subscribe', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint }),
  })
}
