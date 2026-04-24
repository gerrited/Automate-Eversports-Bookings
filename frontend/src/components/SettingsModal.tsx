import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearToken, isActualAdmin } from '../api/client'
import { deleteAccount } from '../api/account'
import { getMe, createCheckoutSession } from '../api/stripe'

interface Props {
  onClose: () => void
}

export default function SettingsModal({ onClose }: Props) {
  const navigate = useNavigate()
  const [confirmText, setConfirmText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [subscriptionActive, setSubscriptionActive] = useState<boolean | null>(null)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  useEffect(() => {
    if (!isActualAdmin()) return
    getMe()
      .then(data => setSubscriptionActive(data.subscription_active))
      .catch(() => setSubscriptionActive(false))
  }, [])

  async function handleDelete() {
    setLoading(true)
    setError(null)
    try {
      await deleteAccount()
      clearToken()
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Löschen des Kontos.')
      setLoading(false)
    }
  }

  async function handleCheckout() {
    setCheckoutLoading(true)
    setCheckoutError(null)
    try {
      const data = await createCheckoutSession()
      window.location.href = data.url
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Fehler beim Starten des Checkouts.')
      setCheckoutLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 px-4">
      <div className="bg-surface-card rounded-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-white font-bold text-lg">Einstellungen</h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors text-xl leading-none"
            aria-label="Schließen"
          >
            ✕
          </button>
        </div>

        {isActualAdmin() && (
          <div className="border-t border-slate-700 pt-5 mb-5">
            <h3 className="text-white font-semibold mb-3">Abonnement</h3>
            <button
              onClick={handleCheckout}
              disabled={subscriptionActive === true || checkoutLoading}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {checkoutLoading
                ? 'Wird vorbereitet…'
                : subscriptionActive
                ? 'Abo bereits aktiv'
                : 'Abo kaufen'}
            </button>
            {checkoutError && <p className="text-red-400 text-sm mt-2">{checkoutError}</p>}
          </div>
        )}

        <div className="border-t border-slate-700 pt-5">
          <h3 className="text-white font-semibold mb-2">Konto löschen</h3>
          <p className="text-red-400 text-sm mb-4">
            Diese Aktion ist unwiderruflich. Dein Konto bei FOReversports und alle geplanten Buchungen werden dauerhaft gelöscht.
          </p>

          <label className="flex flex-col gap-1 mb-4">
            <span className="text-slate-400 text-sm">
              Zur Bestätigung <span className="font-mono text-slate-200">DELETE</span> eingeben
            </span>
            <input
              type="text"
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="bg-surface-input text-white rounded-lg px-3 py-2 outline-hidden focus:ring-2 focus:ring-red-500 font-mono"
            />
          </label>

          {error && <p className="text-red-400 text-sm mb-3">{error}</p>}

          <button
            onClick={handleDelete}
            disabled={confirmText !== 'DELETE' || loading}
            className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading ? 'Wird gelöscht…' : 'Konto löschen'}
          </button>
        </div>
      </div>
    </div>
  )
}
