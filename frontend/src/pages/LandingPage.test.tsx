import { render, screen, within, fireEvent } from '@testing-library/react'
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

  it('renders logo in navbar as home link', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' })
    const home = within(nav).getByRole('link', { name: 'Startseite' })
    // Logo ist dekorativ, der Link trägt den Namen.
    expect(home.querySelector('img')).toHaveAttribute('alt', '')
  })

  it('has a main landmark', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    expect(screen.getByRole('main')).toBeInTheDocument()
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
    expect(screen.getByRole('heading', { name: /einmal einrichten/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /demo-video/i })).toHaveAttribute('href', expect.stringContaining('youtube.com'))
  })

  it('renders screenshot 2 section label', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    expect(screen.getByText(/übersicht behalten/i)).toBeInTheDocument()
  })

  it('demo form is editable and "Buchung speichern" opens login modal', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    const form = screen.getByRole('form', { name: /neue buchung planen/i })
    const course = within(form).getByLabelText('Kursname')
    fireEvent.change(course, { target: { value: 'Yoga' } })
    expect(course).toHaveValue('Yoga')
    fireEvent.change(within(form).getByLabelText('Wochentag'), { target: { value: '3' } })
    expect(within(form).getByLabelText('Wochentag')).toHaveValue('3')
    fireEvent.click(within(form).getByRole('button', { name: 'Erhöhen' }))
    expect(within(form).getByRole('group', { name: 'Tage im Voraus' })).toHaveTextContent('5')

    expect(screen.queryByTestId('login-modal')).not.toBeInTheDocument()
    fireEvent.click(within(form).getByRole('button', { name: /buchung speichern/i }))
    expect(screen.getByTestId('login-modal')).toBeInTheDocument()
  })

  it('demo job list: toggle switches locally, "Buchung planen" opens login modal', () => {
    render(<MemoryRouter><LandingPage /></MemoryRouter>)
    const list = screen.getByRole('region', { name: /geplante buchungen/i })
    const toggle = within(list).getByRole('switch', { name: /montag 18:00/i })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByTestId('login-modal')).not.toBeInTheDocument()

    fireEvent.click(within(list).getByRole('button', { name: /buchung planen/i }))
    expect(screen.getByTestId('login-modal')).toBeInTheDocument()
  })
})
