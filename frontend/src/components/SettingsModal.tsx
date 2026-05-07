import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearToken } from '../api/client'
import { deleteAccount, getMe, updateAccount } from '../api/account'
import { Button, Input, ModalShell } from './ui'

interface Props {
  onClose: () => void
}

type Group = 'verhalten' | 'konto'

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  )
}

export default function SettingsModal({ onClose }: Props) {
  const navigate = useNavigate()
  const [openGroup, setOpenGroup] = useState<Group>('verhalten')

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
    <ModalShell>
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

        {/* Gruppe: Verhalten */}
        <div className="border-t border-slate-700">
          <button
            onClick={() => setOpenGroup('verhalten')}
            aria-expanded={openGroup === 'verhalten'}
            className="w-full flex justify-between items-center py-4 text-white font-semibold hover:text-slate-200 transition-colors"
          >
            <span>Verhalten</span>
            <ChevronIcon open={openGroup === 'verhalten'} />
          </button>
          {openGroup === 'verhalten' && (
            <div className="pb-5">
              {notificationsSupported ? (
                <>
                  <label className="flex flex-col gap-1 mb-4">
                    <span className="text-slate-400 text-sm">Minuten vor dem Termin</span>
                    <div className="w-32">
                      <Input
                        aria-label="Minuten vor dem Termin"
                        type="number"
                        min={15}
                        max={1440}
                        value={advanceMinutes}
                        onChange={(e) => setAdvanceMinutes(Number(e.target.value))}
                      />
                    </div>
                  </label>
                  {saveError && <p className="text-red-400 text-sm mb-3">{saveError}</p>}
                  {saveSuccess && <p className="text-green-400 text-sm mb-3">Gespeichert.</p>}
                  <Button
                    variant="primary"
                    loading={saveLoading}
                    disabled={advanceMinutes < 15 || advanceMinutes > 1440}
                    onClick={handleSave}
                  >
                    Speichern
                  </Button>
                </>
              ) : (
                <p className="text-slate-400 text-sm">
                  Dein Browser unterstützt keine Push-Benachrichtigungen.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Gruppe: Konto */}
        <div className="border-t border-slate-700">
          <button
            onClick={() => setOpenGroup('konto')}
            aria-expanded={openGroup === 'konto'}
            className="w-full flex justify-between items-center py-4 text-white font-semibold hover:text-slate-200 transition-colors"
          >
            <span>Konto</span>
            <ChevronIcon open={openGroup === 'konto'} />
          </button>
          {openGroup === 'konto' && (
            <div className="pb-5">
              <h3 className="text-white font-semibold mb-2">Konto löschen</h3>
              <p className="text-red-400 text-sm mb-4">
                Diese Aktion ist unwiderruflich. Dein Konto bei FOReversports und alle geplanten Buchungen werden dauerhaft gelöscht.
              </p>
              <label className="flex flex-col gap-1 mb-4">
                <span className="text-slate-400 text-sm">
                  Zur Bestätigung <span className="font-mono text-slate-200">DELETE</span> eingeben
                </span>
                <Input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                />
              </label>
              {deleteError && <p className="text-red-400 text-sm mb-3">{deleteError}</p>}
              <Button
                variant="danger"
                loading={deleteLoading}
                disabled={confirmText !== 'DELETE'}
                fullWidth
                onClick={handleDelete}
              >
                Konto löschen
              </Button>
            </div>
          )}
        </div>
      </ModalShell>
  )
}
