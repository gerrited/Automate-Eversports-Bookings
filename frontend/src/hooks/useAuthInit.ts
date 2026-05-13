import { useState, useEffect } from 'react'
import { getToken, clearToken, refreshAccessToken } from '../api/client'

export function useAuthInit(): boolean {
  const [ready, setReady] = useState(!getToken())

  useEffect(() => {
    if (!getToken()) return
    refreshAccessToken().then((success) => {
      if (!success) clearToken()
    }).finally(() => setReady(true))
  }, [])

  return ready
}
