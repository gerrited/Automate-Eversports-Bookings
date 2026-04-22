import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import JobModal from './JobModal'

// apiFetch is mocked here because FacilityCombobox (rendered inside JobModal)
// imports from '../api/facilities', which imports apiFetch from '../api/client'.
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

  it('renders all form fields', () => {
    render(<JobModal onSave={onSave} onClose={onClose} />)
    // Check that all form controls are rendered
    const facilityCombos = screen.getAllByRole('textbox')
    const anbieterInput = facilityCombos.find(el => (el as HTMLInputElement).placeholder?.includes('Anbieter'))
    expect(anbieterInput).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Wochentag' })).toBeInTheDocument()
    expect(screen.getByLabelText('Uhrzeit', { selector: 'input' })).toBeInTheDocument()
    expect(screen.getByLabelText('Kursname', { selector: 'input' })).toBeInTheDocument()
    expect(screen.getByRole('spinbutton', { name: 'Tage im Voraus' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Einmalig' })).toBeInTheDocument()
  })

  it('renders einmalig checkbox unchecked by default', () => {
    render(<JobModal onSave={onSave} onClose={onClose} />)
    const checkbox = screen.getByRole('checkbox', { name: /einmalig/i }) as HTMLInputElement
    expect(checkbox.checked).toBe(false)
  })

  it('calls onSave with one_time false by default', async () => {
    render(<JobModal job={jobWithFacility} onSave={onSave} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /speichern/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ one_time: false })
    ))
  })

  it('calls onSave with one_time true when checkbox is checked', async () => {
    render(<JobModal job={jobWithFacility} onSave={onSave} onClose={onClose} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /einmalig/i }))
    fireEvent.click(screen.getByRole('button', { name: /speichern/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ one_time: true })
    ))
  })

  it('prefills fields when editing an existing job', () => {
    const job = {
      id: 'j1', weekday: 2, target_time: '09:00:00', facility_id: '73041',
      facility_name: 'CrossFit Rabbit Hole', class_name: 'Yoga', days_in_advance: 3,
      enabled: true, one_time: true, created_at: '', debug: false,
    }
    render(<JobModal job={job} onSave={onSave} onClose={onClose} />)
    const kursInput = screen.getByLabelText('Kursname', { selector: 'input' }) as HTMLInputElement
    expect(kursInput.value).toBe('Yoga')
    const daysInput = screen.getByRole('spinbutton', { name: 'Tage im Voraus' }) as HTMLInputElement
    expect(daysInput.value).toBe('3')
    expect((screen.getByRole('checkbox', { name: 'Einmalig' }) as HTMLInputElement).checked).toBe(true)
  })

  it('calls onClose when cancel is clicked', () => {
    render(<JobModal onSave={onSave} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /abbrechen/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
