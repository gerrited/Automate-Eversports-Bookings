const BASE = import.meta.env.VITE_API_BASE_URL ?? ''

function getToken(): string | null {
  return localStorage.getItem('token')
}

export function setToken(token: string): void {
  localStorage.setItem('token', token)
}

export function setRole(role: string): void {
  localStorage.setItem('role', role)
}

export function getRole(): string | null {
  return localStorage.getItem('role')
}

export function isAdmin(): boolean {
  return localStorage.getItem('role') === 'admin'
}

export function setIsActualAdmin(value: boolean): void {
  if (value) {
    localStorage.setItem('isActualAdmin', 'true')
  } else {
    localStorage.removeItem('isActualAdmin')
  }
}

export function isActualAdmin(): boolean {
  return localStorage.getItem('isActualAdmin') === 'true'
}

export function clearToken(): void {
  localStorage.removeItem('token')
  localStorage.removeItem('email')
  localStorage.removeItem('role')
  localStorage.removeItem('avatarUrl')
  localStorage.removeItem('isActualAdmin')
  window.dispatchEvent(new Event('auth-changed'))
}

export function setEmail(email: string): void {
  localStorage.setItem('email', email)
  window.dispatchEvent(new Event('auth-changed'))
}

export function getEmail(): string | null {
  return localStorage.getItem('email')
}

export function setAvatarUrl(url: string): void {
  localStorage.setItem('avatarUrl', url)
}

export function getAvatarUrl(): string | null {
  return localStorage.getItem('avatarUrl')
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const resp = await fetch(`${BASE}${path}`, { ...options, headers })

  if (resp.status === 401) {
    if (getToken()) {
      clearToken()
      window.location.href = '/'
    }
    const body = await resp.json().catch(() => ({}))
    throw new Error(body.detail ?? 'Unauthorized')
  }

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({}))
    throw new Error(body.detail ?? `HTTP ${resp.status}`)
  }

  if (resp.status === 204) return undefined as T
  return resp.json()
}
