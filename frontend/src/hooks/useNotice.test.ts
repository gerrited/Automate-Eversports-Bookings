import { renderHook, waitFor } from '@testing-library/react'
import { vi, afterEach } from 'vitest'
import { useNotice, clearNoticeCache } from './useNotice'

afterEach(() => {
  clearNoticeCache()
  vi.restoreAllMocks()
})

describe('useNotice', () => {
  it('gibt null zurück wenn url undefined ist', () => {
    const { result } = renderHook(() => useNotice(undefined))
    expect(result.current).toBeNull()
  })

  it('lädt Inhalt und gibt ihn zurück', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      text: () => Promise.resolve('Hello **world**'),
    }))
    const { result } = renderHook(() => useNotice('https://gist.example.com/notice.md'))
    await waitFor(() => expect(result.current).toBe('Hello **world**'))
  })

  it('gibt null zurück wenn Inhalt nur Whitespace ist', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      text: () => Promise.resolve('   \n  '),
    }))
    const { result } = renderHook(() => useNotice('https://gist.example.com/notice.md'))
    await waitFor(() => expect(result.current).toBeNull())
  })

  it('gibt null zurück bei Fetch-Fehler', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    const { result } = renderHook(() => useNotice('https://gist.example.com/notice.md'))
    await waitFor(() => expect(result.current).toBeNull())
  })

  it('cached Ergebnisse und ruft fetch nur einmal auf', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      text: () => Promise.resolve('cached content'),
    })
    vi.stubGlobal('fetch', mockFetch)
    const { result } = renderHook(() => useNotice('https://gist.example.com/notice.md'))
    await waitFor(() => expect(result.current).toBe('cached content'))
    renderHook(() => useNotice('https://gist.example.com/notice.md'))
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })
})
