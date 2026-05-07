import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi } from 'vitest'
import WeekdaySelector from './WeekdaySelector'

describe('WeekdaySelector', () => {
  it('rendert 7 Buttons M D M D F S S', () => {
    render(<WeekdaySelector value={0} onChange={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons).toHaveLength(7)
    ;['M', 'D', 'M', 'D', 'F', 'S', 'S'].forEach((label, i) =>
      expect(buttons[i]).toHaveTextContent(label)
    )
  })

  it('markiert aktiven Tag mit aria-pressed=true', () => {
    render(<WeekdaySelector value={2} onChange={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    expect(buttons[2]).toHaveAttribute('aria-pressed', 'true')
    expect(buttons[0]).toHaveAttribute('aria-pressed', 'false')
  })

  it('ruft onChange mit korrektem Index auf bei kurzem Tap', () => {
    const onChange = vi.fn()
    render(<WeekdaySelector value={0} onChange={onChange} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.pointerDown(buttons[4])
    fireEvent.pointerUp(buttons[4])
    expect(onChange).toHaveBeenCalledWith(4)
  })

  it('ruft onChange nicht auf bei Longpress', () => {
    vi.useFakeTimers()
    const onChange = vi.fn()
    render(<WeekdaySelector value={0} onChange={onChange} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.pointerDown(buttons[1])
    act(() => { vi.advanceTimersByTime(600) })
    fireEvent.pointerUp(buttons[1])
    expect(onChange).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('zeigt Tooltip mit vollem Wochentagsnamen nach Longpress', () => {
    vi.useFakeTimers()
    render(<WeekdaySelector value={0} onChange={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.pointerDown(buttons[2])
    act(() => { vi.advanceTimersByTime(600) })
    expect(screen.getByText('Mittwoch')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('blendet Tooltip beim Loslassen aus', () => {
    vi.useFakeTimers()
    render(<WeekdaySelector value={0} onChange={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.pointerDown(buttons[2])
    act(() => { vi.advanceTimersByTime(600) })
    fireEvent.pointerUp(buttons[2])
    expect(screen.queryByText('Mittwoch')).not.toBeInTheDocument()
    vi.useRealTimers()
  })

  it('zeigt keinen Tooltip bei kurzem Tap', () => {
    vi.useFakeTimers()
    render(<WeekdaySelector value={0} onChange={vi.fn()} />)
    const buttons = screen.getAllByRole('button')
    fireEvent.pointerDown(buttons[0])
    act(() => { vi.advanceTimersByTime(100) })
    fireEvent.pointerUp(buttons[0])
    expect(screen.queryByText('Montag')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})
