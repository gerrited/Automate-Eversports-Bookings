import { render, screen, within, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import LandingPage from './LandingPage'
import { takeJobDraft } from '../utils/draftJob'

vi.mock('../components/LoginModal', () => ({
  default: ({ onClose, title }: { onClose: () => void; title?: string }) => (
    <div data-testid="login-modal">
      {title && <h2>{title}</h2>}
      <button onClick={onClose}>Schließen</button>
    </div>
  ),
}))

function renderPage() {
  return render(<MemoryRouter><LandingPage /></MemoryRouter>)
}

beforeEach(() => sessionStorage.clear())

describe('LandingPage', () => {
  it('renders hero headline', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: /kurs voll\?.*nicht für dich/i })).toBeInTheDocument()
  })

  it('renders logo in navbar as home link', () => {
    renderPage()
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' })
    const home = within(nav).getByRole('link', { name: 'Startseite' })
    // Logo ist dekorativ, der Link trägt den Namen.
    expect(home.querySelector('img')).toHaveAttribute('alt', '')
  })

  it('has a main landmark', () => {
    renderPage()
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('renders Anmelden button in navbar', () => {
    renderPage()
    const nav = screen.getByRole('navigation', { name: 'Hauptnavigation' })
    expect(within(nav).getByRole('button', { name: 'Anmelden' })).toBeInTheDocument()
  })

  it('opens login modal when Anmelden is clicked', () => {
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: /anmelden/i })[0])
    expect(screen.getByTestId('login-modal')).toBeInTheDocument()
    // Normales Login übernimmt keinen Plan.
    expect(takeJobDraft()).toBeNull()
  })

  it('closes login modal when onClose is called', () => {
    renderPage()
    fireEvent.click(screen.getAllByRole('button', { name: /anmelden/i })[0])
    fireEvent.click(screen.getByRole('button', { name: /schließen/i }))
    expect(screen.queryByTestId('login-modal')).not.toBeInTheDocument()
  })

  it('renders video section label', () => {
    renderPage()
    expect(screen.getByRole('heading', { name: /einmal einrichten/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /demo-video/i })).toHaveAttribute('href', expect.stringContaining('youtube.com'))
  })

  it('renders screenshot 2 section label', () => {
    renderPage()
    expect(screen.getByText(/übersicht behalten/i)).toBeInTheDocument()
  })

  it('zeigt im Planer den nächsten Buchungsstart', () => {
    renderPage()
    expect(screen.getByText('Nächster Buchungsstart')).toBeInTheDocument()
    expect(screen.getByText(/die buchung öffnet in \d+ tagen/i)).toBeInTheDocument()
  })

  it('übernimmt den geplanten Termin beim Klick auf „automatisch buchen“', () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Donnerstag' }))
    expect(screen.getByRole('button', { name: 'Donnerstag' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.change(screen.getByLabelText('Kursbeginn'), { target: { value: '07:30' } })
    fireEvent.click(within(screen.getByRole('group', { name: 'Tage im Voraus' })).getByRole('button', { name: 'Erhöhen' }))

    expect(screen.getByRole('heading', { name: /dein donnerstag um 07:30 uhr wartet/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /diesen kurs automatisch buchen/i }))
    expect(screen.getByRole('heading', { name: 'Fast geschafft!' })).toBeInTheDocument()
    expect(takeJobDraft()).toEqual({ weekday: 3, target_time: '07:30', days_in_advance: 5 })
  })
})
