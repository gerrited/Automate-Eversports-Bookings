import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import AllLogsSection from './AllLogsSection'

vi.mock('../api/adminLogs', () => ({
  listAllLogs: vi.fn(),
}))

import { listAllLogs } from '../api/adminLogs'

function makePage(count: number, total?: number) {
  const items = Array.from({ length: count }, (_, i) => ({
    id: `log-${i}`,
    job_id: `job-${i}`,
    executed_at: `2026-01-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
    target_date: '2026-01-15',
    status: 'success' as const,
    message: null,
    class_name: 'Yoga',
    facility_name: 'Studio A',
    target_time: '18:00:00',
    weekday: 0,
    debug: false,
    user_email: `user${i}@example.com`,
  }))
  return { items, total: total ?? count, page: 1, page_size: 50 }
}

beforeEach(() => {
  vi.mocked(listAllLogs).mockResolvedValue(makePage(3))
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('AllLogsSection', () => {
  it('zeigt ein Filterfeld an', async () => {
    render(<AllLogsSection />)
    expect(await screen.findByPlaceholderText('Nach E-Mail filtern…')).toBeInTheDocument()
  })

  it('zeigt Log-Einträge an', async () => {
    render(<AllLogsSection />)
    await waitFor(() => {
      expect(screen.getByText('user0@example.com')).toBeInTheDocument()
      expect(screen.getByText('user2@example.com')).toBeInTheDocument()
    })
  })

  it('zeigt Kursname an', async () => {
    render(<AllLogsSection />)
    await waitFor(() => {
      const yogaItems = screen.getAllByText(/Yoga/)
      expect(yogaItems.length).toBeGreaterThan(0)
    })
  })

  it('zeigt Status-Badge an', async () => {
    render(<AllLogsSection />)
    await waitFor(() => {
      expect(screen.getAllByText('Erfolgreich').length).toBeGreaterThan(0)
    })
  })

  it('zeigt Fehlerstatus in Rot', async () => {
    vi.mocked(listAllLogs).mockResolvedValue({
      items: [{
        id: 'log-1', job_id: 'job-1', executed_at: '2026-01-01T10:00:00Z',
        target_date: '2026-01-15', status: 'failed', message: 'Kurs voll',
        class_name: 'Yoga', facility_name: 'Studio A', target_time: '18:00:00',
        weekday: 0, debug: false, user_email: 'test@example.com',
      }],
      total: 1, page: 1, page_size: 50,
    })
    render(<AllLogsSection />)
    await waitFor(() => {
      expect(screen.getByText('Fehlgeschlagen')).toBeInTheDocument()
    })
  })

  it('zeigt lange Nachricht mit "mehr"-Button', async () => {
    const longMsg = 'A'.repeat(70)
    vi.mocked(listAllLogs).mockResolvedValue({
      items: [{
        id: 'log-1', job_id: 'job-1', executed_at: '2026-01-01T10:00:00Z',
        target_date: '2026-01-15', status: 'failed', message: longMsg,
        class_name: 'Yoga', facility_name: 'Studio A', target_time: '18:00:00',
        weekday: 0, debug: false, user_email: 'test@example.com',
      }],
      total: 1, page: 1, page_size: 50,
    })
    render(<AllLogsSection />)
    expect(await screen.findByText('mehr')).toBeInTheDocument()
  })

  it('filter triggert neuen API-Request nach Debounce', async () => {
    render(<AllLogsSection />)
    const input = await screen.findByPlaceholderText('Nach E-Mail filtern…')
    fireEvent.change(input, { target: { value: 'anna' } })
    await waitFor(() => {
      expect(listAllLogs).toHaveBeenCalledWith(1, 'anna')
    }, { timeout: 1000 })
  })

  it('"Zurück"-Button ist auf Seite 1 deaktiviert', async () => {
    render(<AllLogsSection />)
    await screen.findByPlaceholderText('Nach E-Mail filtern…')
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /zurück/i })).toBeDisabled()
    })
  })

  it('"Weiter"-Button ist deaktiviert wenn total <= page_size', async () => {
    render(<AllLogsSection />)
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /weiter/i })).toBeDisabled()
    })
  })

  it('"Weiter" navigiert zur Seite 2', async () => {
    vi.mocked(listAllLogs).mockResolvedValue(makePage(50, 100))
    render(<AllLogsSection />)
    await waitFor(() => {
      expect(screen.getByText(/Seite 1 von 2/)).toBeInTheDocument()
    })
    fireEvent.click(screen.getByRole('button', { name: /weiter/i }))
    await waitFor(() => {
      expect(listAllLogs).toHaveBeenCalledWith(2, undefined)
    })
  })

  it('zeigt "Keine Logs gefunden" bei leerer Antwort', async () => {
    vi.mocked(listAllLogs).mockResolvedValue({ items: [], total: 0, page: 1, page_size: 50 })
    render(<AllLogsSection />)
    expect(await screen.findByText('Keine Logs gefunden.')).toBeInTheDocument()
  })

  it('zeigt Test-Badge für debug-Logs', async () => {
    vi.mocked(listAllLogs).mockResolvedValue({
      items: [{
        id: 'log-1', job_id: 'job-1', executed_at: '2026-01-01T10:00:00Z',
        target_date: '2026-01-15', status: 'success', message: null,
        class_name: 'Yoga', facility_name: 'Studio A', target_time: '18:00:00',
        weekday: 0, debug: true, user_email: 'test@example.com',
      }],
      total: 1, page: 1, page_size: 50,
    })
    render(<AllLogsSection />)
    expect(await screen.findByText('Test')).toBeInTheDocument()
  })
})
