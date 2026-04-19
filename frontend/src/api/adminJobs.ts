import { apiFetch } from './client'
import type { AdminJob } from '../types'

export const listAllJobs = (): Promise<AdminJob[]> =>
  apiFetch('/api/admin/jobs')
