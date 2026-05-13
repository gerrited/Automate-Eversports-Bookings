import { apiFetch, setToken, setRefreshToken, setEmail, setRole, setAvatarUrl, setIsActualAdmin, clearToken } from './client'

export async function login(email: string, password: string): Promise<void> {
  const data = await apiFetch<{ access_token: string; refresh_token: string; role: string; avatar_url?: string | null }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setToken(data.access_token)
  setRefreshToken(data.refresh_token)
  setRole(data.role)
  setIsActualAdmin(data.role === 'admin')
  setEmail(email)
  if (data.avatar_url) setAvatarUrl(data.avatar_url)
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' })
  } finally {
    clearToken()
  }
}
