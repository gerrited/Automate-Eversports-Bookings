// frontend/src/components/NoticeBanner.test.tsx
import { render, screen } from '@testing-library/react'
import { vi, beforeEach } from 'vitest'
import NoticeBanner from './NoticeBanner'
import * as useNoticeModule from '../hooks/useNotice'

beforeEach(() => {
  global.ResizeObserver = vi.fn().mockImplementation(function () {
    return {
      observe: vi.fn(),
      unobserve: vi.fn(),
      disconnect: vi.fn(),
    }
  })
})

describe('NoticeBanner', () => {
  it('rendert nichts wenn url undefined ist', () => {
    vi.spyOn(useNoticeModule, 'useNotice').mockReturnValue(null)
    const { container } = render(<NoticeBanner url={undefined} />)
    expect(container.firstChild).toBeNull()
  })

  it('rendert nichts wenn Inhalt null ist', () => {
    vi.spyOn(useNoticeModule, 'useNotice').mockReturnValue(null)
    const { container } = render(<NoticeBanner url="https://example.com/notice.md" />)
    expect(container.firstChild).toBeNull()
  })

  it('rendert den Nachrichtentext', () => {
    vi.spyOn(useNoticeModule, 'useNotice').mockReturnValue('Wichtiger Hinweis')
    render(<NoticeBanner url="https://example.com/notice.md" />)
    expect(screen.getByText('Wichtiger Hinweis')).toBeInTheDocument()
  })

  it('rendert fetten Text als strong', () => {
    vi.spyOn(useNoticeModule, 'useNotice').mockReturnValue('**Wichtig**: Update verfügbar')
    render(<NoticeBanner url="https://example.com/notice.md" />)
    expect(screen.getByText('Wichtig').tagName).toBe('STRONG')
  })

  it('rendert Link mit korrekten Attributen', () => {
    vi.spyOn(useNoticeModule, 'useNotice').mockReturnValue('[Mehr erfahren](https://example.com)')
    render(<NoticeBanner url="https://example.com/notice.md" />)
    const link = screen.getByRole('link', { name: 'Mehr erfahren' })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('target', '_blank')
  })

  it('setzt CSS-Variable --notice-height beim Mounten', () => {
    vi.spyOn(useNoticeModule, 'useNotice').mockReturnValue('Hinweis')
    const setSpy = vi.spyOn(document.documentElement.style, 'setProperty')
    render(<NoticeBanner url="https://example.com/notice.md" />)
    expect(setSpy).toHaveBeenCalledWith('--notice-height', expect.any(String))
  })

  it('setzt benutzerdefinierte CSS-Variable wenn cssVar angegeben', () => {
    vi.spyOn(useNoticeModule, 'useNotice').mockReturnValue('Hinweis')
    const setSpy = vi.spyOn(document.documentElement.style, 'setProperty')
    render(<NoticeBanner url="https://example.com/notice.md" cssVar="--notice-users-height" />)
    expect(setSpy).toHaveBeenCalledWith('--notice-users-height', expect.any(String))
  })

  it('setzt CSS-Variable auf 0px beim Unmounten', () => {
    vi.spyOn(useNoticeModule, 'useNotice').mockReturnValue('Hinweis')
    const setSpy = vi.spyOn(document.documentElement.style, 'setProperty')
    const { unmount } = render(<NoticeBanner url="https://example.com/notice.md" />)
    unmount()
    expect(setSpy).toHaveBeenCalledWith('--notice-height', '0px')
  })
})
