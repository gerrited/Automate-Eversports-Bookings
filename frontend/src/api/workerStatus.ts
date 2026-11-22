import { apiFetch } from './client'

export interface WorkerStatus {
  last_started_at: string | null
  last_finished_at: string | null
  last_job_count: number | null
  alert_sent_at: string | null
  stale: boolean
  stale_after_minutes: number
}

export const getWorkerStatus = (): Promise<WorkerStatus> =>
  apiFetch('/api/admin/worker-status')
