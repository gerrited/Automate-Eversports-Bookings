import { useState } from 'react'
import type { BookedAppointment } from '../types'

interface Props {
  booking: BookedAppointment
  onCancel: (booking: BookedAppointment) => Promise<void>
}

function formatDatetime(isoStart: string, isoEnd: string): string {
  const start = new Date(isoStart)
  const end = new Date(isoEnd)
  const dateStr = start.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
  const startTime = start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  const endTime = end.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return `${dateStr}, ${startTime} – ${endTime}`
}

export default function BookedAppointmentCard({ booking, onCancel }: Props) {
  const [cancelling, setCancelling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCancel() {
    if (!window.confirm('Buchung wirklich stornieren?')) return
    setCancelling(true)
    setError(null)
    try {
      await onCancel(booking)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Stornierung fehlgeschlagen')
      setCancelling(false)
    }
  }

  return (
    <div className="bg-surface-card rounded-xl overflow-hidden">
      <div className="p-4">
        <p className="text-white font-semibold">{booking.activity_name}</p>
        <p className="text-slate-400 text-sm mt-1">{formatDatetime(booking.start_datetime, booking.end_datetime)}</p>
        <p className="text-slate-400 text-sm">{booking.facility_name}</p>
        <p className="text-slate-400 text-xs">{booking.address}</p>
      </div>

      <div className="flex items-center gap-2 px-4 pb-3 pt-3">
        <button
          onClick={handleCancel}
          disabled={cancelling}
          className="px-3 py-1 rounded-md bg-red-900 hover:bg-red-700 text-red-300 text-sm transition-colors ml-auto disabled:opacity-50"
        >
          {cancelling ? 'Wird storniert…' : 'Stornieren'}
        </button>
      </div>

      {error && (
        <div className="px-4 pb-3 text-sm font-medium text-red-400">{error}</div>
      )}
    </div>
  )
}
