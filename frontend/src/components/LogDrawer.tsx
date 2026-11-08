import { useState } from 'react'
import type { Job, BookingLog } from '../types'
import { WEEKDAY_NAMES } from '../types'
import { Button, ModalShell } from './ui'
import { STATUS_STYLES } from '../utils/statusLabels'

interface Props {
  job: Job
  logs: BookingLog[]
  loading: boolean
  onClose: () => void
}

const STATUS_DRAWER_LABELS: Record<string, string> = {
  success: '✓ Gebucht',
  failed: '✗ Fehler',
  already_booked: '→ Bereits gebucht',
  waitlist: '⏳ Warteliste',
}

export default function LogDrawer({ job, logs, loading, onClose }: Props) {
  const [activeMessage, setActiveMessage] = useState<string | null>(null)

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-surface-card z-50 shadow-2xl flex flex-col">
        <div className="flex justify-between items-center px-5 py-4 border-b border-slate-800">
          <div>
            <p className="text-white font-semibold">
              {WEEKDAY_NAMES[job.weekday]} · {job.target_time.slice(0, 5)} · {job.class_name}
            </p>
            <p className="text-slate-400 text-sm">Ausführungshistorie</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-xl leading-none"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading && (
            <p className="text-slate-400 text-sm">Lädt…</p>
          )}
          {!loading && logs.length === 0 && (
            <p className="text-slate-400 text-sm">Noch keine Ausführungen.</p>
          )}
          {!loading && logs.map(log => (
            <div key={log.id} className="mb-4 border-b border-slate-800 pb-4">
              <div className="flex justify-between items-center">
                <span className={`text-sm font-medium ${STATUS_STYLES[log.status] ?? 'text-slate-300'}`}>
                  {STATUS_DRAWER_LABELS[log.status] ?? log.status}
                </span>
                <span className="text-slate-500 text-xs">
                  {log.target_date}
                </span>
              </div>
              {log.message && (
                <button
                  onClick={() => setActiveMessage(log.message)}
                  className="text-slate-500 text-xs mt-1 hover:text-slate-300 underline underline-offset-2 text-left"
                >
                  Details anzeigen
                </button>
              )}
              <p className="text-slate-600 text-xs mt-1">
                {new Date(log.executed_at).toLocaleString('de-DE')}
              </p>
            </div>
          ))}
        </div>
      </div>

      {activeMessage && (
        <ModalShell
          onBackdropClick={() => setActiveMessage(null)}
          zIndex="z-60"
        >
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <p className="text-white font-semibold">Fehlermeldung</p>
              <button
                onClick={() => setActiveMessage(null)}
                className="text-slate-400 hover:text-white text-xl leading-none"
              >
                ✕
              </button>
            </div>
            <pre className="text-slate-300 text-xs font-mono whitespace-pre-wrap break-all bg-slate-900 rounded-lg p-3 max-h-64 overflow-y-auto">
              {activeMessage}
            </pre>
            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setActiveMessage(null)}>
                Schließen
              </Button>
            </div>
          </div>
        </ModalShell>
      )}
    </>
  )
}
