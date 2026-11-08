import { render, screen } from '@testing-library/react'
import Input from './Input'

describe('Input', () => {
  it('rendert mit placeholder', () => {
    render(<Input placeholder="E-Mail" />)
    expect(screen.getByPlaceholderText('E-Mail')).toBeInTheDocument()
  })

  it('reicht type-Prop durch', () => {
    render(<Input type="email" placeholder="E-Mail" />)
    expect(screen.getByPlaceholderText('E-Mail')).toHaveAttribute('type', 'email')
  })

  it('reicht required-Prop durch', () => {
    render(<Input required placeholder="Pflichtfeld" />)
    expect(screen.getByPlaceholderText('Pflichtfeld')).toBeRequired()
  })

  it('reicht aria-label durch', () => {
    render(<Input aria-label="Tage im Voraus" type="number" />)
    expect(screen.getByRole('spinbutton', { name: 'Tage im Voraus' })).toBeInTheDocument()
  })

  it('reicht min und max durch', () => {
    render(<Input type="number" min={1} max={30} aria-label="Tage" />)
    const input = screen.getByRole('spinbutton', { name: 'Tage' })
    expect(input).toHaveAttribute('min', '1')
    expect(input).toHaveAttribute('max', '30')
  })

  it('reicht autoFocus durch', () => {
    render(<Input autoFocus aria-label="Suche" />)
    expect(screen.getByRole('textbox', { name: 'Suche' })).toHaveFocus()
  })
})
