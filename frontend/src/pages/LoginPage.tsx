import { useState } from 'react'
import type { FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../api/auth'

export default function LoginPage() {
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
    <div className="min-h-screen bg-surface-page flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6">
          <img src="/logo.png" alt="Logo" className="h-16 w-auto" />
        </div>
        <form onSubmit={handleSubmit} className="bg-surface-card rounded-xl p-8 flex flex-col gap-4">
          <p className="text-slate-400 text-sm text-center">Nutze deine Eversports Anmeldedaten, um fortzufahren.</p>
          <input
            type="email"
            placeholder="E-Mail"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="bg-surface-input text-white rounded-lg px-4 py-3 outline-hidden focus:ring-2 focus:ring-brand [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_var(--color-surface-input)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:white]"
          />
          <input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="bg-surface-input text-white rounded-lg px-4 py-3 outline-hidden focus:ring-2 focus:ring-brand [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_var(--color-surface-input)_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:white]"
          />
          {error && (
            <p role="alert" className="text-red-400 text-sm">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="bg-brand hover:bg-brand-hover disabled:opacity-50 text-white font-semibold rounded-lg py-3 transition-colors"
          >
            {loading ? 'Anmelden…' : 'Anmelden'}
          </button>
        </form>
      </div>
    </div>
  )
}
