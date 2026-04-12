import { apiFetch, setToken, setEmail, setRole } from './client'

export async function login(email: string, password: string): Promise<void> {
  const data = await apiFetch<{ access_token: string; role: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setToken(data.access_token)
  setRole(data.role)
  setEmail(email)
}
