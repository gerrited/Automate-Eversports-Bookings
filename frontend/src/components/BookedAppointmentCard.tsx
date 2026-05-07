import { useState } from 'react'
import type { BookedAppointment } from '../types'
import { Button } from './ui'

interface Props {
  booking: BookedAppointment
  onCancel: (booking: BookedAppointment) => Promise<void>
}

function formatHeader(isoStart: string): string {
  const start = new Date(isoStart)
  const dateStr = start.toLocaleDateString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit' })
  const startTime = start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return `${dateStr} · ${startTime} Uhr`
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
        <p className="text-white font-semibold">
          {formatHeader(booking.start_datetime)} · {booking.activity_name}
        </p>
        <p className="text-slate-400 text-sm mt-1">
          {booking.facility_name} · {booking.address}
        </p>
      </div>

      <div className="flex items-center gap-2 px-4 pb-3 pt-3">
        <div className="ml-auto">
          <Button
            variant="danger"
            size="sm"
            loading={cancelling}
            onClick={handleCancel}
          >
            Stornieren
          </Button>
        </div>
      </div>

      {error && (
        <div className="px-4 pb-3 text-sm font-medium text-red-400">{error}</div>
      )}
    </div>
  )
}
