import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { Button, Input, ModalShell } from './ui'
import Logo from './Logo'

interface Props {
  onClose: () => void
}

export default function LoginModal({ onClose }: Props) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(email, password)
      onClose()
      navigate('/dashboard')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : ''
      setError(
        msg === 'Account nicht freigegeben'
          ? 'Dein Account wartet auf Freigabe'
          : msg || 'Login fehlgeschlagen'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <ModalShell onBackdropClick={onClose} maxWidth="sm" testId="login-modal-backdrop">
      <button
        type="button"
        aria-label="Schließen"
        onClick={onClose}
        className="absolute top-4 right-4 w-11 h-11 rounded-xl flex items-center justify-center text-muted hover:bg-white/5 hover:text-white transition-colors"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>

      <div className="flex flex-col items-center gap-7 pt-4">
        <Logo size="lg" stacked />

        <div className="flex flex-col items-center gap-2 text-center">
          <h2 className="text-[26px] font-extrabold tracking-[-0.02em] text-white">Willkommen zurück</h2>
          <p className="text-base leading-normal text-muted">Nutze deine Eversports-Anmeldedaten, um fortzufahren.</p>
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-[18px]">
          <div className="flex flex-col gap-2">
            <label htmlFor="login-email" className="text-sm font-semibold text-slate-300">E-Mail</label>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder="name@beispiel.de"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="login-password" className="text-sm font-semibold text-slate-300">Passwort</label>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder="Dein Eversports-Passwort"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {error && (
            <p role="alert" className="rounded-xl border border-red-900 bg-red-900/20 px-4 py-3 text-sm text-red-300">{error}</p>
          )}
          <div className="mt-1.5">
            <Button variant="primary" size="lg" type="submit" loading={loading} fullWidth>
              Anmelden
              {!loading && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
              )}
            </Button>
          </div>
        </form>

        <p className="flex items-center gap-2 text-[13px] text-faint text-center">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-accent shrink-0">
            <rect x="4" y="10.5" width="16" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
          </svg>
          Kein neues Konto nötig – dein Eversports-Login genügt.
        </p>
      </div>
    </ModalShell>
  )
}
