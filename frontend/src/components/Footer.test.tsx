// frontend/src/components/Footer.test.tsx
import { render, screen } from '@testing-library/react'
import { vi, afterEach } from 'vitest'
import Footer from './Footer'

vi.mock('../api/client', () => ({ getEmail: () => null }))

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('Footer', () => {
  it('renders nothing when no sha, version, or email', () => {
    const { container } = render(<Footer />)
    expect(container.firstChild).toBeNull()
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
    expect(screen.getByText('·')).toBeInTheDocument()
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
})
