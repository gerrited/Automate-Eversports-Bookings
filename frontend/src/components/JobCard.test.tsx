import { render, screen, fireEvent } from '@testing-library/react'
import { act } from 'react'
import { vi } from 'vitest'
import JobCard from './JobCard'
import type { Job } from '../types'

const job: Job = {
  id: 'job-1',
  weekday: 1,
  target_time: '18:00:00',
  facility_id: '73041',
  facility_name: 'CrossFit Rabbit Hole',
  class_name: 'CrossFit',
  days_in_advance: 4,
  enabled: true,
  one_time: false,
  debug: false,
  created_at: '2026-04-01T00:00:00Z',
}

describe('JobCard', () => {
  it('renders weekday, time and class name', () => {
    render(
      <JobCard job={job} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
    )
    expect(screen.getByText(/Dienstag/)).toBeInTheDocument()
    expect(screen.getByText(/18:00/)).toBeInTheDocument()
    expect(screen.getAllByText(/CrossFit/)[0]).toBeInTheDocument()
  })

  it('does not show Einmalig for regular jobs', () => {
    render(
      <JobCard job={job} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
    )
    expect(screen.queryByText(/Einmalig/)).not.toBeInTheDocument()
  })

  it('shows Einmalig in text for one-time jobs', () => {
    render(
      <JobCard job={{ ...job, one_time: true }} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
    )
    expect(screen.getByText(/Einmalig/)).toBeInTheDocument()
  })

  it('calls onToggle when toggle is clicked', () => {
    const onToggle = vi.fn()
    render(
      <JobCard job={job} onToggle={onToggle} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
    )
    fireEvent.click(screen.getByRole('switch'))
    expect(onToggle).toHaveBeenCalledWith('job-1')
  })

  it('calls onEdit when edit button is clicked', () => {
    const onEdit = vi.fn()
    render(
      <JobCard job={job} onToggle={vi.fn()} onEdit={onEdit} onDelete={vi.fn()} onSelect={vi.fn()} />
    )
    fireEvent.click(screen.getByRole('button', { name: /bearbeiten/i }))
    expect(onEdit).toHaveBeenCalledWith(job)
  })

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = vi.fn()
    render(
      <JobCard job={job} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={onDelete} onSelect={vi.fn()} />
    )
    fireEvent.click(screen.getByRole('button', { name: /löschen/i }))
    expect(onDelete).toHaveBeenCalledWith('job-1')
  })

  it('calls onSelect when card body is clicked', () => {
    const onSelect = vi.fn()
    render(
      <JobCard job={job} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={onSelect} />
    )
    fireEvent.click(screen.getByTestId('job-card-body'))
    expect(onSelect).toHaveBeenCalledWith(job)
  })

  describe('onExecute', () => {
    it('zeigt keinen Jetzt-buchen-Button ohne onExecute-Prop', () => {
      render(
        <JobCard job={job} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
      )
      expect(screen.queryByRole('button', { name: /jetzt buchen/i })).not.toBeInTheDocument()
    })

    it('zeigt Jetzt-buchen-Button wenn onExecute übergeben wird', () => {
      render(
        <JobCard job={job} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} onExecute={vi.fn()} />
      )
      expect(screen.getByRole('button', { name: /jetzt buchen/i })).toBeInTheDocument()
    })

    it('ruft onExecute mit job.id auf wenn Button geklickt', async () => {
      const onExecute = vi.fn().mockResolvedValue({ status: 'success', message: '2026-04-28' })
      render(
        <JobCard job={job} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} onExecute={onExecute} />
      )
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /jetzt buchen/i }))
      })
      expect(onExecute).toHaveBeenCalledWith('job-1')
    })

    it('zeigt Erfolgsmeldung nach erfolgreicher Buchung', async () => {
      const onExecute = vi.fn().mockResolvedValue({ status: 'success', message: '2026-04-28' })
      render(
        <JobCard job={job} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} onExecute={onExecute} />
      )
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /jetzt buchen/i }))
      })
      expect(screen.getByText(/erfolgreich gebucht/i)).toBeInTheDocument()
    })

    it('zeigt Fehlermeldung bei fehlgeschlagener Buchung', async () => {
      const onExecute = vi.fn().mockResolvedValue({ status: 'failed', message: 'CrossFit not found' })
      render(
        <JobCard job={job} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} onExecute={onExecute} />
      )
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /jetzt buchen/i }))
      })
      expect(screen.getByText(/CrossFit not found/)).toBeInTheDocument()
    })

    it('zeigt already_booked Meldung', async () => {
      const onExecute = vi.fn().mockResolvedValue({ status: 'already_booked', message: '2026-04-28' })
      render(
        <JobCard job={job} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} onExecute={onExecute} />
      )
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: /jetzt buchen/i }))
      })
      expect(screen.getByText(/bereits gebucht/i)).toBeInTheDocument()
    })
  })
})
