import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import Button from './Button'

describe('Button', () => {
  it('rendert children', () => {
    render(<Button variant="primary">Speichern</Button>)
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeInTheDocument()
  })

  it('ist nicht disabled per default', () => {
    render(<Button variant="primary">Speichern</Button>)
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('ist disabled wenn disabled-Prop gesetzt', () => {
    render(<Button variant="primary" disabled>Speichern</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('ist disabled wenn loading', () => {
    render(<Button variant="primary" loading>Speichern</Button>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('zeigt Spinner wenn loading', () => {
    const { container } = render(<Button variant="primary" loading>Speichern</Button>)
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('zeigt keinen Spinner ohne loading', () => {
    const { container } = render(<Button variant="primary">Speichern</Button>)
    expect(container.querySelector('.animate-spin')).not.toBeInTheDocument()
  })

  it('ruft onClick auf wenn geklickt', () => {
    const onClick = vi.fn()
    render(<Button variant="primary" onClick={onClick}>Speichern</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('ruft onClick nicht auf wenn disabled', () => {
    const onClick = vi.fn()
    render(<Button variant="primary" disabled onClick={onClick}>Speichern</Button>)
    fireEvent.click(screen.getByRole('button'))
    expect(onClick).not.toHaveBeenCalled()
  })

  it('hat type=button per default', () => {
    render(<Button variant="primary">Speichern</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('nutzt type=submit wenn angegeben', () => {
    render(<Button variant="primary" type="submit">Speichern</Button>)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit')
  })

  it('setzt aria-label wenn übergeben', () => {
    render(<Button variant="danger" size="sm" aria-label="Buchung löschen">✕</Button>)
    expect(screen.getByRole('button', { name: 'Buchung löschen' })).toBeInTheDocument()
  })
})
