import { apiFetch, setToken, setEmail, setRole, setAvatarUrl, setIsActualAdmin } from './client'

export async function login(email: string, password: string): Promise<void> {
  const data = await apiFetch<{ access_token: string; role: string; avatar_url?: string | null }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setToken(data.access_token)
  setRole(data.role)
  setIsActualAdmin(data.role === 'admin')
  setEmail(email)
  if (data.avatar_url) setAvatarUrl(data.avatar_url)
}
