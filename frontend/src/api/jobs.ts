import { apiFetch } from './client'
import type { Job, JobFormData, BookingLog } from '../types'

export const listJobs = (): Promise<Job[]> =>
  apiFetch('/api/jobs')

export const createJob = (data: JobFormData): Promise<Job> =>
  apiFetch('/api/jobs', { method: 'POST', body: JSON.stringify(data) })

export const updateJob = (id: string, data: Partial<JobFormData>): Promise<Job> =>
  apiFetch(`/api/jobs/${id}`, { method: 'PUT', body: JSON.stringify(data) })

export const toggleJob = (id: string): Promise<Job> =>
  apiFetch(`/api/jobs/${id}/toggle`, { method: 'PATCH' })

export const deleteJob = (id: string): Promise<void> =>
  apiFetch(`/api/jobs/${id}`, { method: 'DELETE' })

export const getJobLogs = (id: string): Promise<BookingLog[]> =>
  apiFetch(`/api/jobs/${id}/logs`)
