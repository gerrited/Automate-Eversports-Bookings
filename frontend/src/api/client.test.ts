import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { apiFetch, setToken, clearToken } from './client'

// window.location.href ist in jsdom read-only — überschreiben
const locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location')
beforeEach(() => {
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { href: '' },
  })
  window.localStorage.clear()
})
afterEach(() => {
  if (locationDescriptor) {
    Object.defineProperty(window, 'location', locationDescriptor)
  }
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function mockFetch(...responses: Partial<Response>[]) {
  const fn = vi.fn()
  responses.forEach((r) =>
    fn.mockResolvedValueOnce({
      ok: r.ok ?? true,
      status: r.status ?? 200,
      json: r.json ?? (async () => ({})),
    })
  )
  vi.stubGlobal('fetch', fn)
  return fn
}

describe('apiFetch', () => {
  it('sendet credentials: include bei jedem Request', async () => {
    const fetch = mockFetch({ status: 200, ok: true, json: async () => ({ ok: true }) })
    await apiFetch('/api/test')
    expect(fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ credentials: 'include' })
    )
  })

  it('wiederholt Request mit neuem Token nach erfolgreichem Refresh bei 401', async () => {
    setToken('expired-token')
    const fetch = mockFetch(
      { status: 401, ok: false, json: async () => ({}) },
      { status: 200, ok: true, json: async () => ({ access_token: 'new-token', token_type: 'bearer' }) },
      { status: 200, ok: true, json: async () => ({ result: 'ok' }) }
    )

    const result = await apiFetch<{ result: string }>('/api/test')

    expect(fetch).toHaveBeenCalledTimes(3)
    expect(window.localStorage.getItem('token')).toBe('new-token')
    expect(result).toEqual({ result: 'ok' })
  })

  it('löscht Token und leitet weiter, wenn Refresh bei 401 fehlschlägt', async () => {
    setToken('expired-token')
    mockFetch(
      { status: 401, ok: false, json: async () => ({}) },
      { status: 401, ok: false, json: async () => ({}) }
    )

    await apiFetch('/api/test').catch(() => {})

    expect(window.localStorage.getItem('token')).toBeNull()
    expect((window.location as { href: string }).href).toBe('/')
  })

  it('versucht keinen Refresh bei 401 ohne Token', async () => {
    const fetch = mockFetch({ status: 401, ok: false, json: async () => ({ detail: 'Unauthorized' }) })

    await expect(apiFetch('/api/test')).rejects.toThrow('Unauthorized')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
