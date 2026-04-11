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
    expect(screen.getByLabelText(/facility/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/tage im voraus/i)).toBeInTheDocument()
  })

  it('calls onSave with form data on submit', async () => {
    render(<JobModal onSave={onSave} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText(/uhrzeit/i), { target: { value: '18:00' } })
    fireEvent.change(screen.getByLabelText(/kursname/i), { target: { value: 'CrossFit' } })
    fireEvent.change(screen.getByLabelText(/facility/i), { target: { value: '73041' } })
    fireEvent.change(screen.getByLabelText(/tage im voraus/i), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: /speichern/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ class_name: 'CrossFit', facility_id: '73041', days_in_advance: 4 })
    ))
  })

  it('prefills fields when editing an existing job', () => {
    const job = {
      id: 'j1', weekday: 2, target_time: '09:00:00', facility_id: '73041',
      class_name: 'Yoga', days_in_advance: 3, enabled: true, created_at: '',
    }
    render(<JobModal job={job} onSave={onSave} onClose={onClose} />)
    expect((screen.getByLabelText(/kursname/i) as HTMLInputElement).value).toBe('Yoga')
    expect((screen.getByLabelText(/tage im voraus/i) as HTMLInputElement).value).toBe('3')
  })

  it('calls onClose when cancel is clicked', () => {
    render(<JobModal onSave={onSave} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /abbrechen/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
