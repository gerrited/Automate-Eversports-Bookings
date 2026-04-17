import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import JobModal from './JobModal'

describe('JobModal', () => {
  const onSave = vi.fn()
  const onClose = vi.fn()

  it('renders all form fields', () => {
    render(<JobModal onSave={onSave} onClose={onClose} />)
    expect(screen.getByLabelText(/wochentag/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/uhrzeit/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/kursname/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/tage im voraus/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/einmalig/i)).toBeInTheDocument()
  })

  it('renders einmalig checkbox unchecked by default', () => {
    render(<JobModal onSave={onSave} onClose={onClose} />)
    const checkbox = screen.getByLabelText(/einmalig/i) as HTMLInputElement
    expect(checkbox.checked).toBe(false)
  })

  it('calls onSave with one_time false by default', async () => {
    render(<JobModal onSave={onSave} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText(/uhrzeit/i), { target: { value: '18:00' } })
    fireEvent.change(screen.getByLabelText(/kursname/i), { target: { value: 'CrossFit' } })
    fireEvent.change(screen.getByLabelText(/tage im voraus/i), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: /speichern/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ one_time: false })
    ))
  })

  it('calls onSave with one_time true when checkbox is checked', async () => {
    render(<JobModal onSave={onSave} onClose={onClose} />)
    fireEvent.click(screen.getByLabelText(/einmalig/i))
    fireEvent.click(screen.getByRole('button', { name: /speichern/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ one_time: true })
    ))
  })

  it('prefills fields when editing an existing job', () => {
    const job = {
      id: 'j1', weekday: 2, target_time: '09:00:00', facility_id: '73041',
      facility_name: 'CrossFit Rabbit Hole', class_name: 'Yoga', days_in_advance: 3,
      enabled: true, one_time: true, created_at: '',
    }
    render(<JobModal job={job} onSave={onSave} onClose={onClose} />)
    expect((screen.getByLabelText(/kursname/i) as HTMLInputElement).value).toBe('Yoga')
    expect((screen.getByLabelText(/tage im voraus/i) as HTMLInputElement).value).toBe('3')
    expect((screen.getByLabelText(/einmalig/i) as HTMLInputElement).checked).toBe(true)
  })

  it('calls onClose when cancel is clicked', () => {
    render(<JobModal onSave={onSave} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /abbrechen/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
