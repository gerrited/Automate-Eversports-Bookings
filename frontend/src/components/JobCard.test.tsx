import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import JobCard from './JobCard'
import type { Job } from '../types'

const job: Job = {
  id: 'job-1',
  weekday: 1,
  target_time: '18:00:00',
  facility_id: '73041',
  class_name: 'CrossFit',
  days_in_advance: 4,
  enabled: true,
  created_at: '2026-04-01T00:00:00Z',
}

describe('JobCard', () => {
  it('renders weekday, time and class name', () => {
    render(
      <JobCard job={job} onToggle={vi.fn()} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
    )
    expect(screen.getByText(/Di/)).toBeInTheDocument()
    expect(screen.getByText(/18:00/)).toBeInTheDocument()
    expect(screen.getByText('CrossFit')).toBeInTheDocument()
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
})
