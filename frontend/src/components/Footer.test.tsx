// frontend/src/components/Footer.test.tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi, afterEach } from 'vitest'
import Footer from './Footer'

vi.mock('../api/client', () => ({ getEmail: () => null }))

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Footer', () => {
  it('renders only the FAQ link when no sha or version is set', () => {
    render(<Footer />)
    expect(screen.getByRole('button', { name: 'FAQ' })).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('renders version link pointing to GitHub releases when VITE_VERSION is set', () => {
    vi.stubEnv('VITE_VERSION', '1.2.3')
    vi.stubEnv('VITE_GITHUB_REPO', 'gerrited/automate-eversports-bookings')
    render(<Footer />)
    const link = screen.getByRole('link', { name: 'v1.2.3' })
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/gerrited/automate-eversports-bookings/releases/tag/v1.2.3'
    )
  })

  it('renders SHA link pointing to GitHub commit when VITE_COMMIT_SHA is set', () => {
    vi.stubEnv('VITE_COMMIT_SHA', 'abc1234567890')
    vi.stubEnv('VITE_GITHUB_REPO', 'gerrited/automate-eversports-bookings')
    render(<Footer />)
    const link = screen.getByRole('link', { name: 'abc1234' })
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/gerrited/automate-eversports-bookings/commit/abc1234567890'
    )
  })

  it('renders both version and SHA separated by · when both are set', () => {
    vi.stubEnv('VITE_VERSION', '1.2.3')
    vi.stubEnv('VITE_COMMIT_SHA', 'abc1234567890')
    vi.stubEnv('VITE_GITHUB_REPO', 'gerrited/automate-eversports-bookings')
    render(<Footer />)
    expect(screen.getByRole('link', { name: 'v1.2.3' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'abc1234' })).toBeInTheDocument()
    expect(screen.getAllByText('·')).toHaveLength(2)
  })

  it('renders version without link when VITE_GITHUB_REPO is absent', () => {
    vi.stubEnv('VITE_VERSION', '1.2.3')
    render(<Footer />)
    expect(screen.getByText('v1.2.3')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('renders SHA as plain text when VITE_GITHUB_REPO is absent', () => {
    vi.stubEnv('VITE_COMMIT_SHA', 'abc1234567890')
    render(<Footer />)
    expect(screen.getByText('abc1234')).toBeInTheDocument()
    expect(screen.queryByRole('link')).toBeNull()
  })

  it('always renders the FAQ link even without env vars', () => {
    render(<Footer />)
    expect(screen.getByRole('button', { name: 'FAQ' })).toBeInTheDocument()
  })

  it('opens FaqModal when FAQ link is clicked', async () => {
    render(<Footer />)
    await userEvent.click(screen.getByRole('button', { name: 'FAQ' }))
    expect(screen.getByText('Häufig gestellte Fragen')).toBeInTheDocument()
  })

  it('closes FaqModal when close button inside modal is clicked', async () => {
    render(<Footer />)
    await userEvent.click(screen.getByRole('button', { name: 'FAQ' }))
    await userEvent.click(screen.getByRole('button', { name: 'Schließen' }))
    expect(screen.queryByText('Häufig gestellte Fragen')).not.toBeInTheDocument()
  })
})
