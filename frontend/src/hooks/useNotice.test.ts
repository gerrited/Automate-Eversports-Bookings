import { renderHook, waitFor } from '@testing-library/react'
import { vi, afterEach } from 'vitest'
import { useNotice } from './useNotice'

afterEach(() => {
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

  it('ruft fetch mit cache: no-store auf', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      text: () => Promise.resolve('content'),
    })
    vi.stubGlobal('fetch', mockFetch)
    const { result } = renderHook(() => useNotice('https://gist.example.com/notice.md'))
    await waitFor(() => expect(result.current).toBe('content'))
    expect(mockFetch).toHaveBeenCalledWith('https://gist.example.com/notice.md', { cache: 'no-store' })
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

  it('zeigt nach URL-Wechsel nicht den Inhalt der alten URL', async () => {
    let resolveSecond: (v: { text: () => Promise<string> }) => void = () => {}
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({ text: () => Promise.resolve('alt') })
      .mockReturnValueOnce(new Promise(r => { resolveSecond = r })))
    const { result, rerender } = renderHook(({ url }) => useNotice(url), {
      initialProps: { url: 'https://gist.example.com/a.md' },
    })
    await waitFor(() => expect(result.current).toBe('alt'))
    rerender({ url: 'https://gist.example.com/b.md' })
    expect(result.current).toBeNull()
    resolveSecond({ text: () => Promise.resolve('neu') })
    await waitFor(() => expect(result.current).toBe('neu'))
  })
})

