import { render, screen, fireEvent } from '@testing-library/react'
import { vi } from 'vitest'
import HamburgerMenu from './HamburgerMenu'

function renderMenu(onLogout = vi.fn(), onSettings = vi.fn()) {
  return render(<HamburgerMenu onLogout={onLogout} onSettings={onSettings} />)
}

afterEach(() => {
  vi.clearAllMocks()
})

describe('HamburgerMenu', () => {
  it('renders the menu button', () => {
    renderMenu()
    expect(screen.getByLabelText('Menü öffnen')).toBeInTheDocument()
  })

  it('dropdown is not visible initially', () => {
    renderMenu()
    expect(screen.queryByText('Einstellungen')).not.toBeInTheDocument()
    expect(screen.queryByText('Abmelden')).not.toBeInTheDocument()
  })

  it('opens dropdown when button is clicked', () => {
    renderMenu()
    fireEvent.click(screen.getByLabelText('Menü öffnen'))
    expect(screen.getByText('Einstellungen')).toBeInTheDocument()
    expect(screen.getByText('Abmelden')).toBeInTheDocument()
  })

  it('calls onSettings and closes dropdown when Einstellungen is clicked', () => {
    const onSettings = vi.fn()
    renderMenu(vi.fn(), onSettings)
    fireEvent.click(screen.getByLabelText('Menü öffnen'))
    fireEvent.click(screen.getByText('Einstellungen'))
    expect(onSettings).toHaveBeenCalledOnce()
    expect(screen.queryByText('Einstellungen')).not.toBeInTheDocument()
  })

  it('calls onLogout and closes dropdown when Abmelden is clicked', () => {
    const onLogout = vi.fn()
    renderMenu(onLogout)
    fireEvent.click(screen.getByLabelText('Menü öffnen'))
    fireEvent.click(screen.getByText('Abmelden'))
    expect(onLogout).toHaveBeenCalledOnce()
    expect(screen.queryByText('Abmelden')).not.toBeInTheDocument()
  })

  it('closes dropdown when clicking outside', () => {
    renderMenu()
    fireEvent.click(screen.getByLabelText('Menü öffnen'))
    expect(screen.getByText('Einstellungen')).toBeInTheDocument()
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('Einstellungen')).not.toBeInTheDocument()
  })
})
