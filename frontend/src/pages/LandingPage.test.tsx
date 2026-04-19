import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import LandingPage from './LandingPage'

vi.mock('../components/LoginModal', () => ({
  default: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="login-modal">
      <button onClick={onClose}>Schließen</button>
    </div>
  ),
}))

describe('LandingPage', () => {
  it('renders hero headline', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    expect(screen.getByText(/nie wieder/i)).toBeInTheDocument()
  })

  it('renders logo in navbar', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    expect(screen.getByAltText(/logo/i)).toBeInTheDocument()
  })

  it('renders Anmelden button in navbar', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    expect(screen.getAllByRole('button', { name: /anmelden/i }).length).toBeGreaterThan(0)
  })

  it('opens login modal when Anmelden is clicked', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    fireEvent.click(screen.getAllByRole('button', { name: /anmelden/i })[0])
    expect(screen.getByTestId('login-modal')).toBeInTheDocument()
  })

  it('closes login modal when onClose is called', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    fireEvent.click(screen.getAllByRole('button', { name: /anmelden/i })[0])
    fireEvent.click(screen.getByRole('button', { name: /schließen/i }))
    expect(screen.queryByTestId('login-modal')).not.toBeInTheDocument()
  })

  it('renders video section label', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    expect(screen.getByText(/so funktioniert/i)).toBeInTheDocument()
  })

  it('renders screenshot 2 section label', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    expect(screen.getByText(/übersicht behalten/i)).toBeInTheDocument()
  })
})
