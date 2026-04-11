import type { Job, BookingLog } from '../types'
import { WEEKDAY_NAMES } from '../types'

interface Props {
  job: Job
  logs: BookingLog[]
  loading: boolean
  onClose: () => void
}

const statusColor: Record<string, string> = {
  success: 'text-green-400',
  failed: 'text-red-400',
  already_booked: 'text-slate-400',
}

const statusLabel: Record<string, string> = {
  success: '✓ Gebucht',
  failed: '✗ Fehler',
  already_booked: '→ Bereits gebucht',
}

export default function LogDrawer({ job, logs, loading, onClose }: Props) {
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-sm bg-slate-900 z-50 shadow-2xl flex flex-col">
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
                <span className={`text-sm font-medium ${statusColor[log.status] ?? 'text-slate-300'}`}>
                  {statusLabel[log.status] ?? log.status}
                </span>
                <span className="text-slate-500 text-xs">
                  {log.target_date}
                </span>
              </div>
              {log.message && (
                <p className="text-slate-400 text-xs mt-1 font-mono break-all">{log.message}</p>
              )}
              <p className="text-slate-600 text-xs mt-1">
                {new Date(log.executed_at).toLocaleString('de-DE')}
              </p>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
