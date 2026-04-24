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
  const [confirmOpen, setConfirmOpen] = useState(false)

  async function handleCancel() {
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
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex flex-col gap-2">
      <div className="text-sm text-gray-500">{formatDatetime(booking.start_datetime, booking.end_datetime)}</div>
      <div className="font-semibold text-gray-900">{booking.activity_name}</div>
      <div className="text-sm text-gray-600">{booking.facility_name}</div>
      <div className="text-xs text-gray-400">{booking.address}</div>

      {error && <div className="text-xs text-red-500 mt-1">{error}</div>}

      {!confirmOpen ? (
        <button
          onClick={() => setConfirmOpen(true)}
          className="mt-2 self-start text-sm text-red-500 hover:text-red-700 transition-colors"
        >
          Stornieren
        </button>
      ) : (
        <div className="mt-2 flex items-center gap-3">
          <span className="text-sm text-gray-700">Wirklich stornieren?</span>
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="text-sm text-red-600 font-medium hover:text-red-800 disabled:opacity-50"
          >
            {cancelling ? 'Wird storniert…' : 'Ja, stornieren'}
          </button>
          <button
            onClick={() => setConfirmOpen(false)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Abbrechen
          </button>
        </div>
      )}
    </div>
  )
}
