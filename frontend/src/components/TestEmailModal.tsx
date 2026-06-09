import { useState } from 'react'
import { sendTestEmail, type TestEmailType } from '../api/adminEmail'
import { AlertMessage, ModalShell } from './ui'

interface Props {
  onClose: () => void
}

const EMAIL_TYPES: { type: TestEmailType; label: string }[] = [
  { type: 'new_user', label: 'Neuer Benutzer registriert' },
  { type: 'account_activated', label: 'Konto freigeschaltet' },
  { type: 'account_deactivated', label: 'Konto deaktiviert' },
  { type: 'booking_failure', label: 'Buchung fehlgeschlagen' },
  { type: 'debug_cancel_failure', label: 'Debug-Stornierung fehlgeschlagen' },
]

export default function TestEmailModal({ onClose }: Props) {
  const [sending, setSending] = useState<TestEmailType | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSend(type: TestEmailType) {
    setSending(type)
    setSuccess(null)
    setError(null)
    try {
      await sendTestEmail(type)
      setSuccess('Test-Mail gesendet.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Senden.')
    } finally {
      setSending(null)
    }
  }

  return (
    <ModalShell onBackdropClick={onClose}>
      <div className="flex justify-between items-center mb-5">
        <h2 className="text-white font-bold text-lg">Test-Mails verschicken</h2>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white transition-colors text-xl leading-none"
          aria-label="Schließen"
        >
          ✕
        </button>
      </div>

      <p className="text-slate-400 text-sm mb-4">
        Sendet eine Test-Mail an deine eigene Adresse.
      </p>

      <div className="flex flex-col gap-2">
        {EMAIL_TYPES.map(({ type, label }) => (
          <button
            key={type}
            onClick={() => handleSend(type)}
            disabled={sending !== null}
            className="w-full text-left px-4 py-3 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending === type ? 'Wird gesendet…' : label}
          </button>
        ))}
      </div>

      {success && <AlertMessage type="success" className="mt-4">{success}</AlertMessage>}
      {error && <AlertMessage type="error" className="mt-4">{error}</AlertMessage>}
    </ModalShell>
  )
}
