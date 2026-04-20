import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import AllJobsSection from './AllJobsSection'

vi.mock('../api/adminJobs', () => ({
  listAllJobs: vi.fn(),
}))

import { listAllJobs } from '../api/adminJobs'

function makeJobs(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `job-${i}`,
    user_email: `user${i}@example.com`,
    weekday: i % 7,
    target_time: '18:00:00',
    facility_id: 'fac-1',
    facility_name: 'Studio A',
    class_name: 'Yoga',
    days_in_advance: 3,
    enabled: true,
    one_time: false,
    created_at: '2026-01-01T00:00:00Z',
    execution_count: i,
  }))
}

beforeEach(() => {
  vi.mocked(listAllJobs).mockResolvedValue(makeJobs(60))
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('AllJobsSection', () => {
  it('zeigt ein Filterfeld an', async () => {
    render(<AllJobsSection />)
    expect(await screen.findByPlaceholderText('Nach Benutzer filtern…')).toBeInTheDocument()
  })

  it('zeigt ohne Filter maximal 25 Jobs an (Seite 1)', async () => {
    render(<AllJobsSection />)
    await screen.findByPlaceholderText('Nach Benutzer filtern…')
    expect(screen.getAllByText(/user\d+@example\.com/).length).toBe(25)
  })

  it('filter begrenzt Ergebnisse nach user_email', async () => {
    vi.mocked(listAllJobs).mockResolvedValue([
      { id: '1', user_email: 'anna@firma.de', weekday: 0, target_time: '08:00:00', facility_id: 'f1', facility_name: 'Studio A', class_name: 'Yoga', days_in_advance: 3, enabled: true, one_time: false, created_at: '', execution_count: 2 },
      { id: '2', user_email: 'bernd@xyz.org', weekday: 1, target_time: '10:00:00', facility_id: 'f1', facility_name: 'Studio A', class_name: 'Pilates', days_in_advance: 3, enabled: true, one_time: false, created_at: '', execution_count: 0 },
      { id: '3', user_email: 'anna@test.de', weekday: 2, target_time: '18:00:00', facility_id: 'f1', facility_name: 'Studio B', class_name: 'Boxing', days_in_advance: 3, enabled: false, one_time: true, created_at: '', execution_count: 5 },
    ])
    render(<AllJobsSection />)
    const input = await screen.findByPlaceholderText('Nach Benutzer filtern…')
    fireEvent.change(input, { target: { value: 'anna' } })
    expect(screen.getAllByText(/anna@/).length).toBe(2)
    expect(screen.queryByText('bernd@xyz.org')).not.toBeInTheDocument()
  })

  it('filter setzt Seite auf 1 zurück', async () => {
    render(<AllJobsSection />)
    const input = await screen.findByPlaceholderText('Nach Benutzer filtern…')
    fireEvent.click(screen.getByRole('button', { name: /weiter/i }))
    expect(await screen.findByText(/Seite 2 von/)).toBeInTheDocument()
    fireEvent.change(input, { target: { value: 'user' } })
    expect(screen.getByText(/Seite 1 von/)).toBeInTheDocument()
  })

  it('"Zurück"-Button ist auf Seite 1 deaktiviert', async () => {
    render(<AllJobsSection />)
    await screen.findByPlaceholderText('Nach Benutzer filtern…')
    expect(screen.getByRole('button', { name: /zurück/i })).toBeDisabled()
  })

  it('"Weiter"-Button ist auf der letzten Seite deaktiviert', async () => {
    vi.mocked(listAllJobs).mockResolvedValue(makeJobs(10))
    render(<AllJobsSection />)
    await screen.findByPlaceholderText('Nach Benutzer filtern…')
    expect(screen.getByRole('button', { name: /weiter/i })).toBeDisabled()
  })

  it('"Weiter" navigiert zur nächsten Seite', async () => {
    render(<AllJobsSection />)
    await screen.findByPlaceholderText('Nach Benutzer filtern…')
    fireEvent.click(screen.getByRole('button', { name: /weiter/i }))
    expect(await screen.findByText(/Seite 2 von 3/)).toBeInTheDocument()
  })

  it('pre-fills email filter from initialEmailFilter prop', async () => {
    const jobs = [
      {
        id: 1,
        user_email: 'alice@example.com',
        weekday: 1,
        target_time: '09:00:00',
        class_name: 'Yoga',
        facility_name: 'Studio A',
        days_in_advance: 3,
        one_time: false,
        execution_count: 2,
      },
      {
        id: 2,
        user_email: 'bob@example.com',
        weekday: 2,
        target_time: '10:00:00',
        class_name: 'Pilates',
        facility_name: 'Studio B',
        days_in_advance: 2,
        one_time: false,
        execution_count: 0,
      },
    ]
    vi.mocked(listAllJobs).mockResolvedValue(jobs)

    render(<AllJobsSection initialEmailFilter="alice@example.com" />)

    await waitFor(() => {
      expect(screen.getByDisplayValue('alice@example.com')).toBeInTheDocument()
      expect(screen.getByText('alice@example.com')).toBeInTheDocument()
      expect(screen.queryByText('bob@example.com')).not.toBeInTheDocument()
    })
  })

  it('zeigt Kursname und Anzahl Durchführungen an', async () => {
    vi.mocked(listAllJobs).mockResolvedValue([
      { id: '1', user_email: 'anna@firma.de', weekday: 0, target_time: '08:00:00', facility_id: 'f1', facility_name: 'Studio A', class_name: 'Yoga', days_in_advance: 3, enabled: true, one_time: false, created_at: '', execution_count: 7 },
    ])
    render(<AllJobsSection />)
    await screen.findByPlaceholderText('Nach Benutzer filtern…')
    expect(screen.getByText('Yoga')).toBeInTheDocument()
    expect(screen.getByText(/7.*ausgeführt/i)).toBeInTheDocument()
  })
})
