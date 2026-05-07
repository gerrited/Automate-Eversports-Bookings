import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import { vi } from 'vitest'
import JobModal from './JobModal'

vi.mock('../api/client', () => ({
  isAdmin: vi.fn(() => false),
  apiFetch: vi.fn(),
}))

vi.mock('../api/facilities', () => ({
  getCourses: vi.fn(() => Promise.resolve([])),
}))

const jobWithFacility = {
  id: 'j1', weekday: 1, target_time: '18:00:00', facility_id: '73041',
  facility_name: 'CrossFit Rabbit Hole', class_name: 'CrossFit', days_in_advance: 4,
  enabled: true, one_time: false, created_at: '', debug: false,
}

describe('JobModal', () => {
  const onSave = vi.fn()
  const onClose = vi.fn()

  it('rendert alle Formularfelder', async () => {
    render(<JobModal onSave={onSave} onClose={onClose} />)
    const facilityCombos = screen.getAllByRole('textbox')
    expect(facilityCombos.find(el => (el as HTMLInputElement).placeholder?.includes('Anbieter'))).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('group', { name: 'Wochentag' })).toBeInTheDocument()
      expect(screen.getByLabelText('Uhrzeit', { selector: 'input' })).toBeInTheDocument()
      expect(screen.getByLabelText('Kursname', { selector: 'input' })).toBeInTheDocument()
      expect(screen.getByRole('group', { name: 'Tage im Voraus' })).toBeInTheDocument()
      expect(screen.getByRole('checkbox', { name: 'Einmalig' })).toBeInTheDocument()
    })
  })

  it('rendert Einmalig-Checkbox deaktiviert per default', () => {
    render(<JobModal onSave={onSave} onClose={onClose} />)
    expect((screen.getByRole('checkbox', { name: /einmalig/i }) as HTMLInputElement).checked).toBe(false)
  })

  it('ruft onSave mit one_time false per default auf', async () => {
    render(<JobModal job={jobWithFacility} onSave={onSave} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /speichern/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ one_time: false })
    ))
  })

  it('ruft onSave mit one_time true auf wenn Checkbox aktiviert', async () => {
    render(<JobModal job={jobWithFacility} onSave={onSave} onClose={onClose} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /einmalig/i }))
    fireEvent.click(screen.getByRole('button', { name: /speichern/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ one_time: true })
    ))
  })

  it('befüllt Felder beim Bearbeiten einer vorhandenen Buchung', () => {
    const job = {
      id: 'j1', weekday: 2, target_time: '09:00:00', facility_id: '73041',
      facility_name: 'CrossFit Rabbit Hole', class_name: 'Yoga', days_in_advance: 3,
      enabled: true, one_time: true, created_at: '', debug: false,
    }
    render(<JobModal job={job} onSave={onSave} onClose={onClose} />)

    const kursInput = screen.getByLabelText('Kursname', { selector: 'input' }) as HTMLInputElement
    expect(kursInput.value).toBe('Yoga')

    const stepperGroup = screen.getByRole('group', { name: 'Tage im Voraus' })
    expect(within(stepperGroup).getByText('3')).toBeInTheDocument()

    const weekdayGroup = screen.getByRole('group', { name: 'Wochentag' })
    const dayButtons = within(weekdayGroup).getAllByRole('button')
    expect(dayButtons[2]).toHaveAttribute('aria-pressed', 'true')

    expect((screen.getByRole('checkbox', { name: 'Einmalig' }) as HTMLInputElement).checked).toBe(true)
  })

  it('ruft onClose auf wenn Abbrechen geklickt', () => {
    render(<JobModal onSave={onSave} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /abbrechen/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
