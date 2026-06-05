import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import CalendarSubscriptionBlock from './CalendarSubscriptionBlock'
import * as calendarApi from '../api/calendar'

vi.mock('../api/calendar')

const mockGetCalendarToken = vi.mocked(calendarApi.getCalendarToken)
const mockRegenerateCalendarToken = vi.mocked(calendarApi.regenerateCalendarToken)

beforeEach(() => {
  mockGetCalendarToken.mockResolvedValue({ token: 'test-token-123' })
  mockRegenerateCalendarToken.mockResolvedValue({ token: 'new-token-456' })
  Object.defineProperty(window, 'location', {
    value: { host: 'localhost:5173' },
    writable: true,
  })
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  })
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})

describe('CalendarSubscriptionBlock', () => {
  it('shows loading state initially', () => {
    render(<CalendarSubscriptionBlock />)
    expect(screen.getByText('Kalender abonnieren')).toBeInTheDocument()
  })

  it('shows subscription URL after token loads', async () => {
    render(<CalendarSubscriptionBlock />)
    await waitFor(() => {
      expect(screen.getByDisplayValue(/webcal:\/\/localhost:5173\/api\/calendar\/feed\.ics\?token=test-token-123/)).toBeInTheDocument()
    })
  })

  it('copies URL to clipboard on copy button click', async () => {
    render(<CalendarSubscriptionBlock />)
    await waitFor(() => screen.getByRole('button', { name: 'Kopieren' }))
    await userEvent.click(screen.getByRole('button', { name: 'Kopieren' }))
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'webcal://localhost:5173/api/calendar/feed.ics?token=test-token-123'
    )
  })

  it('regenerates token on reset click', async () => {
    render(<CalendarSubscriptionBlock />)
    await waitFor(() => screen.getByRole('button', { name: 'Token zurücksetzen' }))
    await userEvent.click(screen.getByRole('button', { name: 'Token zurücksetzen' }))
    await waitFor(() => {
      expect(screen.getByDisplayValue(/token=new-token-456/)).toBeInTheDocument()
    })
  })
})
