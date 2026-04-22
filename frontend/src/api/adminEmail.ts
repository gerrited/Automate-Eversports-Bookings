import { apiFetch } from './client'

export type TestEmailType =
  | 'new_user'
  | 'account_activated'
  | 'account_deactivated'
  | 'booking_failure'
  | 'debug_cancel_failure'

export async function sendTestEmail(type: TestEmailType): Promise<void> {
  await apiFetch<{ detail: string }>('/api/admin/test-email', {
    method: 'POST',
    body: JSON.stringify({ type }),
  })
}
