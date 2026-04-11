import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { vi } from 'vitest'
import LoginPage from './LoginPage'
import * as authApi from '../api/auth'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: () => mockNavigate }
})

describe('LoginPage', () => {
  it('renders email and password fields', () => {
    render(<MemoryRouter><LoginPage /></MemoryRouter>)
    expect(screen.getByPlaceholderText(/e-mail/i)).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/passwort/i)).toBeInTheDocument()
  })

  it('calls login and navigates on success', async () => {
    vi.spyOn(authApi, 'login').mockResolvedValue(undefined)
    render(<MemoryRouter><LoginPage /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText(/e-mail/i), { target: { value: 'a@b.com' } })
    fireEvent.change(screen.getByPlaceholderText(/passwort/i), { target: { value: 'pass' } })
    fireEvent.click(screen.getByRole('button', { name: /einloggen/i }))
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/dashboard'))
  })

  it('shows error message on failed login', async () => {
    vi.spyOn(authApi, 'login').mockRejectedValue(new Error('Invalid Eversports credentials'))
    render(<MemoryRouter><LoginPage /></MemoryRouter>)
    fireEvent.change(screen.getByPlaceholderText(/e-mail/i), { target: { value: 'bad@b.com' } })
    fireEvent.change(screen.getByPlaceholderText(/passwort/i), { target: { value: 'wrong' } })
    fireEvent.click(screen.getByRole('button', { name: /einloggen/i }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  })
})
