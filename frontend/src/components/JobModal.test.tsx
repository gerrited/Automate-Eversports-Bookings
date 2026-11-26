import { StrictMode } from 'react'
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
      expect(screen.getByRole('combobox', { name: 'Wochentag' })).toBeInTheDocument()
      expect(screen.getByLabelText('Uhrzeit', { selector: 'input' })).toBeInTheDocument()
      expect(screen.getByLabelText('Kursname', { selector: 'input' })).toBeInTheDocument()
      expect(screen.getByRole('group', { name: 'Tage im Voraus' })).toBeInTheDocument()
      expect(screen.getByRole('group', { name: 'Häufigkeit' })).toBeInTheDocument()
    })
  })

  it('rendert Wöchentlich als Standard-Häufigkeit', () => {
    render(<JobModal onSave={onSave} onClose={onClose} />)
    const group = screen.getByRole('group', { name: 'Häufigkeit' })
    expect(within(group).getByRole('button', { name: 'Wöchentlich' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(group).getByRole('button', { name: 'Einmalig' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('ruft onSave mit one_time false per default auf', async () => {
    render(<JobModal job={jobWithFacility} onSave={onSave} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /speichern/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ one_time: false })
    ))
  })

  it('ruft onSave mit one_time true auf wenn Einmalig gewählt', async () => {
    render(<JobModal job={jobWithFacility} onSave={onSave} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Einmalig' }))
    fireEvent.click(screen.getByRole('button', { name: /speichern/i }))
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ one_time: true })
    ))
  })

  it('befüllt Felder beim Bearbeiten einer vorhandenen Buchung', async () => {
    const job = {
      id: 'j1', weekday: 2, target_time: '09:00:00', facility_id: '73041',
      facility_name: 'CrossFit Rabbit Hole', class_name: 'Yoga', days_in_advance: 3,
      enabled: true, one_time: true, created_at: '', debug: false,
    }
    render(<JobModal job={job} onSave={onSave} onClose={onClose} />)

    await waitFor(() => {
      const kursInput = screen.getByLabelText('Kursname', { selector: 'input' }) as HTMLInputElement
      expect(kursInput.value).toBe('Yoga')

      const stepperGroup = screen.getByRole('group', { name: 'Tage im Voraus' })
      expect(within(stepperGroup).getByText('3')).toBeInTheDocument()

      const weekdaySelect = screen.getByRole('combobox', { name: 'Wochentag' }) as HTMLSelectElement
      expect(weekdaySelect.value).toBe('2')

      const haeufigkeitGroup = screen.getByRole('group', { name: 'Häufigkeit' })
      expect(within(haeufigkeitGroup).getByRole('button', { name: 'Einmalig' })).toHaveAttribute('aria-pressed', 'true')
    })
  })

  it('ruft onClose auf wenn Abbrechen geklickt', () => {
    render(<JobModal onSave={onSave} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /abbrechen/i }))
    expect(onClose).toHaveBeenCalled()
  })

  it('schließt mit Esc', () => {
    render(<JobModal onSave={onSave} onClose={onClose} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Esc in offener Kursliste schließt erst die Liste, dann den Dialog', () => {
    render(<JobModal job={jobWithFacility} onSave={onSave} onClose={onClose} />)
    const course = screen.getByLabelText('Kursname', { selector: 'input' })
    fireEvent.focus(course)
    fireEvent.keyDown(course, { key: 'Escape' })
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.keyDown(course, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('behält den Kursnamen beim Öffnen zum Bearbeiten (auch unter StrictMode)', async () => {
    render(<StrictMode><JobModal job={jobWithFacility} onSave={onSave} onClose={onClose} /></StrictMode>)
    const course = screen.getByLabelText('Kursname', { selector: 'input' }) as HTMLInputElement
    await waitFor(() => expect(course.value).toBe('CrossFit'))
  })

  it('leert den Kursnamen, wenn der Wochentag geändert wird', async () => {
    render(<JobModal job={jobWithFacility} onSave={onSave} onClose={onClose} />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Wochentag' }), { target: { value: '3' } })
    const course = screen.getByLabelText('Kursname', { selector: 'input' }) as HTMLInputElement
    await waitFor(() => expect(course.value).toBe(''))
  })

  it('übernimmt einen Entwurf von der Landing Page', () => {
    render(<JobModal draft={{ weekday: 3, target_time: '07:30', days_in_advance: 6 }} onSave={onSave} onClose={onClose} />)
    expect(screen.getByRole('combobox', { name: 'Wochentag' })).toHaveValue('3')
    expect(screen.getByLabelText('Uhrzeit', { selector: 'input' })).toHaveValue('07:30')
    expect(within(screen.getByRole('group', { name: 'Tage im Voraus' })).getByText('6')).toBeInTheDocument()
  })
})
