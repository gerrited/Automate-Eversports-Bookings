import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import LoginModal from './LoginModal'
import * as authApi from '../api/auth'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('LoginModal', () => {
  it('renders email and password fields', () => {
    render(<MemoryRouter><LoginModal onClose={vi.fn()} /></MemoryRouter>)
    expect(screen.getByPlaceholderText(/e-mail/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/passwort/i)).toBeInTheDocument()
  })

  it('calls login, navigates and closes on success', async () => {
    const onClose = vi.fn()
    vi.spyOn(authApi, 'login').mockResolvedValue(undefined)
    render(<MemoryRouter><LoginModal onClose={onClose} /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText(/e-mail/i), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByPlaceholderText(/passwort/i), { target: { value: 'pass' } })
    fireEvent.click(screen.getByRole('button', { name: /anmelden/i }))
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard')
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('shows error message on failed login', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValue(new Error('Invalid credentials'))
    render(<MemoryRouter><LoginModal onClose={vi.fn()} /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText(/e-mail/i), { target: { value: 'bad@b.com' } })
    fireEvent.change(screen.getByPlaceholderText(/passwort/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /anmelden/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn()
    render(<MemoryRouter><LoginModal onClose={onClose} /></MemoryRouter>)
    fireEvent.click(screen.getByTestId('login-modal-backdrop'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls onClose when X button is clicked', () => {
    const onClose = vi.fn()
    render(<MemoryRouter><LoginModal onClose={onClose} /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /schließen/i }))
    expect(onClose).toHaveBeenCalled()
  })
})
