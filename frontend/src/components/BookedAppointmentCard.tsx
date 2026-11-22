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

  const start = new Date(booking.start_datetime)
  const abbr = start.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '').slice(0, 2).toUpperCase()
  const time = start.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })

  return (
    <article className="flex flex-col rounded-[20px] border border-[#15303a] bg-surface-card transition-colors hover:border-[#24464d]">
      <div className="flex items-start gap-4 p-[18px] sm:p-[22px] pb-4 sm:pb-5">
        <span aria-hidden="true" className="shrink-0 w-[62px] h-[62px] rounded-2xl bg-brand flex flex-col items-center justify-center gap-0.5">
          <span className="text-xs font-extrabold tracking-[0.08em] text-accent">{abbr}</span>
          <span className="text-[15px] font-extrabold tabular-nums text-white">{time}</span>
        </span>
        <span className="flex-1 min-w-0 flex flex-col gap-[5px]">
          <span className="text-[17px] sm:text-lg font-extrabold text-white break-words">
            {formatHeader(booking.start_datetime)} · {booking.activity_name}
          </span>
          <span className="text-sm leading-snug text-muted break-words">
            {booking.facility_name} · {booking.address}
          </span>
        </span>
      </div>

      <div className="mx-[18px] sm:mx-[22px] flex items-center gap-2.5 border-t border-line-subtle py-4">
        <div className="ml-auto">
          <Button
            variant="danger"
            loading={cancelling}
            onClick={handleCancel}
          >
            Stornieren
          </Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="mx-[18px] sm:mx-[22px] mb-4 -mt-1 text-sm font-medium text-red-400">{error}</div>
      )}
    </article>
  )
}
