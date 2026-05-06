import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearToken } from '../api/client'
import { deleteAccount, getMe, updateAccount } from '../api/account'

interface Props {
  onClose: () => void
}

export default function SettingsModal({ onClose }: Props) {
  const navigate = useNavigate()
  const [confirmText, setConfirmText] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [advanceMinutes, setAdvanceMinutes] = useState<number>(60)
  const [saveLoading, setSaveLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const notificationsSupported =
    typeof Notification !== 'undefined' && 'serviceWorker' in navigator

  useEffect(() => {
    getMe().then((me) => setAdvanceMinutes(me.notification_advance_minutes)).catch(() => {})
  }, [])

  async function handleSave() {
    setSaveLoading(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      await updateAccount({ notification_advance_minutes: advanceMinutes })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Fehler beim Speichern.')
    } finally {
      setSaveLoading(false)
    }
  }

  async function handleDelete() {
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      await deleteAccount()
      clearToken()
      navigate('/')
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Fehler beim Löschen des Kontos.')
      setDeleteLoading(false)
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

        {/* Terminerinnerung */}
        <div className="border-t border-slate-700 pt-5 mb-5">
          <h3 className="text-white font-semibold mb-2">Terminerinnerung</h3>
          {notificationsSupported ? (
            <>
              <label className="flex flex-col gap-1 mb-4">
                <span className="text-slate-400 text-sm">Minuten vor dem Termin</span>
                <input
                  aria-label="Minuten vor dem Termin"
                  type="number"
                  min={15}
                  max={1440}
                  value={advanceMinutes}
                  onChange={(e) => setAdvanceMinutes(Number(e.target.value))}
                  className="bg-surface-input text-white rounded-lg px-3 py-2 outline-hidden focus:ring-2 focus:ring-blue-500 w-32"
                />
              </label>
              {saveError && <p className="text-red-400 text-sm mb-3">{saveError}</p>}
              {saveSuccess && <p className="text-green-400 text-sm mb-3">Gespeichert.</p>}
              <button
                onClick={handleSave}
                disabled={saveLoading || advanceMinutes < 15 || advanceMinutes > 1440}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {saveLoading ? 'Wird gespeichert…' : 'Speichern'}
              </button>
            </>
          ) : (
            <p className="text-slate-400 text-sm">
              Dein Browser unterstützt keine Push-Benachrichtigungen.
            </p>
          )}
        </div>

        {/* Konto löschen */}
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
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="bg-surface-input text-white rounded-lg px-3 py-2 outline-hidden focus:ring-2 focus:ring-red-500 font-mono"
            />
          </label>

          {deleteError && <p className="text-red-400 text-sm mb-3">{deleteError}</p>}

          <button
            onClick={handleDelete}
            disabled={confirmText !== 'DELETE' || deleteLoading}
            className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {deleteLoading ? 'Wird gelöscht…' : 'Konto löschen'}
          </button>
        </div>
      </div>
    </div>
  )
}
