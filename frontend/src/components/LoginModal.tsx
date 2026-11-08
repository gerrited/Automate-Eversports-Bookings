import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/auth'
import { Button, Input, ModalShell } from './ui'

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
        className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
      >
        ✕
      </button>

      <div className="flex justify-center mb-4 mt-2">
        <img src="/logo.png" alt="Logo" className="h-12 w-auto" />
      </div>

      <p className="text-slate-400 text-sm text-center mb-4">
        Nutze deine Eversports Anmeldedaten, um fortzufahren.
      </p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input
          type="email"
          placeholder="E-Mail"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Passwort"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
        />
        {error && (
          <p role="alert" className="text-red-400 text-sm">{error}</p>
        )}
        <Button variant="primary" type="submit" loading={loading} fullWidth>
          Anmelden
        </Button>
      </form>
    </ModalShell>
  )
}
