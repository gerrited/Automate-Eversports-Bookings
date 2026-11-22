import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'
import WorkerStatusCard from './WorkerStatusCard'
import { getWorkerStatus } from '../api/workerStatus'

vi.mock('../api/workerStatus', () => ({ getWorkerStatus: vi.fn() }))

const base = {
  last_started_at: '2026-11-22T07:00:00Z',
  last_finished_at: '2026-11-22T07:02:00Z',
  last_job_count: 3,
  alert_sent_at: null,
  stale: false,
  stale_after_minutes: 35,
}

describe('WorkerStatusCard', () => {
  it('zeigt laufenden Worker mit letztem Lauf in Berliner Zeit', async () => {
    vi.mocked(getWorkerStatus).mockResolvedValue(base)
    render(<WorkerStatusCard />)
    expect(await screen.findByText('Worker läuft')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Letzter Start: 22.11., 08:00 Uhr')
    expect(screen.getByRole('status')).toHaveTextContent('3 Jobs im letzten Lauf')
  })

  it('warnt bei Ausfall', async () => {
    vi.mocked(getWorkerStatus).mockResolvedValue({ ...base, stale: true, alert_sent_at: '2026-11-22T08:00:00Z' })
    render(<WorkerStatusCard />)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Worker reagiert nicht – seit über 35 Minuten kein Lauf')
    expect(alert).toHaveTextContent('Admins per E-Mail benachrichtigt')
  })

  it('meldet, wenn der Worker noch nie gelaufen ist', async () => {
    vi.mocked(getWorkerStatus).mockResolvedValue({ ...base, last_started_at: null, last_finished_at: null, last_job_count: null })
    render(<WorkerStatusCard />)
    expect(await screen.findByText('Worker ist noch nie gelaufen')).toBeInTheDocument()
  })

  it('zeigt Fehlerhinweis, wenn der Status nicht geladen werden kann', async () => {
    vi.mocked(getWorkerStatus).mockRejectedValue(new Error('x'))
    render(<WorkerStatusCard />)
    expect(await screen.findByText('Worker-Status konnte nicht geladen werden.')).toBeInTheDocument()
  })
})
