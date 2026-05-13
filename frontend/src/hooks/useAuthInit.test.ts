import { renderHook, waitFor } from '@testing-library/react'
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest'

const mockRefreshAccessToken = vi.fn()
const mockClearToken = vi.fn()
const mockGetToken = vi.fn()

vi.mock('../api/client', () => ({
  refreshAccessToken: mockRefreshAccessToken,
  clearToken: mockClearToken,
  getToken: mockGetToken,
}))

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useAuthInit', () => {
  it('ist sofort bereit wenn kein Token gespeichert ist', async () => {
    mockGetToken.mockReturnValue(null)

    const { useAuthInit } = await import('./useAuthInit')
    const { result } = renderHook(() => useAuthInit())

    expect(result.current).toBe(true)
  })

  it('ist bereit und behält Token nach erfolgreichem Refresh', async () => {
    mockGetToken.mockReturnValue('expired-token')
    mockRefreshAccessToken.mockResolvedValue(true)

    const { useAuthInit } = await import('./useAuthInit')
    const { result } = renderHook(() => useAuthInit())

    await waitFor(() => expect(result.current).toBe(true))
    expect(mockRefreshAccessToken).toHaveBeenCalledOnce()
    expect(mockClearToken).not.toHaveBeenCalled()
  })

  it('löscht Token und ist bereit wenn Refresh fehlschlägt', async () => {
    mockGetToken.mockReturnValue('expired-token')
    mockRefreshAccessToken.mockResolvedValue(false)

    const { useAuthInit } = await import('./useAuthInit')
    const { result } = renderHook(() => useAuthInit())

    await waitFor(() => expect(result.current).toBe(true))
    expect(mockClearToken).toHaveBeenCalledOnce()
  })
})
