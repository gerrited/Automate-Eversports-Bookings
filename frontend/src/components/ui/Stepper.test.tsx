import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import Stepper from './Stepper'

describe('Stepper', () => {
  it('zeigt aktuellen Wert', () => {
    render(<Stepper value={4} onChange={vi.fn()} min={1} max={30} aria-label="Tage im Voraus" />)
    expect(screen.getByText('4')).toBeInTheDocument()
  })

  it('ruft onChange mit Wert+1 auf bei Klick auf +', () => {
    const onChange = vi.fn()
    render(<Stepper value={4} onChange={onChange} min={1} max={30} aria-label="Tage im Voraus" />)
    fireEvent.click(screen.getByText('+'))
    expect(onChange).toHaveBeenCalledWith(5)
  })

  it('ruft onChange mit Wert-1 auf bei Klick auf −', () => {
    const onChange = vi.fn()
    render(<Stepper value={4} onChange={onChange} min={1} max={30} aria-label="Tage im Voraus" />)
    fireEvent.click(screen.getByText('−'))
    expect(onChange).toHaveBeenCalledWith(3)
  })

  it('geht nicht unter min', () => {
    const onChange = vi.fn()
    render(<Stepper value={1} onChange={onChange} min={1} max={30} aria-label="Tage im Voraus" />)
    fireEvent.click(screen.getByText('−'))
    expect(onChange).toHaveBeenCalledWith(1)
  })

  it('geht nicht über max', () => {
    const onChange = vi.fn()
    render(<Stepper value={30} onChange={onChange} min={1} max={30} aria-label="Tage im Voraus" />)
    fireEvent.click(screen.getByText('+'))
    expect(onChange).toHaveBeenCalledWith(30)
  })

  it('wechselt in Edit-Modus bei Klick auf Zahl', () => {
    render(<Stepper value={4} onChange={vi.fn()} min={1} max={30} aria-label="Tage im Voraus" />)
    fireEvent.click(screen.getByText('4'))
    expect(screen.getByRole('spinbutton')).toBeInTheDocument()
  })

  it('speichert Direkteingabe bei Enter', () => {
    const onChange = vi.fn()
    render(<Stepper value={4} onChange={onChange} min={1} max={30} aria-label="Tage im Voraus" />)
    fireEvent.click(screen.getByText('4'))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '7' } })
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(7)
  })

  it('speichert Direkteingabe bei Blur', () => {
    const onChange = vi.fn()
    render(<Stepper value={4} onChange={onChange} min={1} max={30} aria-label="Tage im Voraus" />)
    fireEvent.click(screen.getByText('4'))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '12' } })
    fireEvent.blur(screen.getByRole('spinbutton'))
    expect(onChange).toHaveBeenCalledWith(12)
  })

  it('clipped Wert auf max bei zu großer Eingabe', () => {
    const onChange = vi.fn()
    render(<Stepper value={4} onChange={onChange} min={1} max={30} aria-label="Tage im Voraus" />)
    fireEvent.click(screen.getByText('4'))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '99' } })
    fireEvent.keyDown(screen.getByRole('spinbutton'), { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith(30)
  })

  it('verwirft leere Eingabe — alter Wert bleibt', () => {
    const onChange = vi.fn()
    render(<Stepper value={4} onChange={onChange} min={1} max={30} aria-label="Tage im Voraus" />)
    fireEvent.click(screen.getByText('4'))
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '' } })
    fireEvent.blur(screen.getByRole('spinbutton'))
    expect(onChange).not.toHaveBeenCalled()
  })
})
