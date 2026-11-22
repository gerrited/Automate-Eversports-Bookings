import type { Job } from '../types'

const TZ = 'Europe/Berlin'

/** "Mi, 26.11. 07:00" — Zeitpunkt in Berliner Zeit (wie der Worker rechnet). */
export function formatRunAt(iso: string): string {
  const d = new Date(iso)
  const day = d.toLocaleDateString('de-DE', { timeZone: TZ, weekday: 'short', day: '2-digit', month: '2-digit' })
  const time = d.toLocaleTimeString('de-DE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })
  return `${day} ${time}`
}

/** "Fr, 28.11." — reines Kalenderdatum ohne Zeitzonen-Verschiebung. */
export function formatClassDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('de-DE', {
    timeZone: 'UTC', weekday: 'short', day: '2-digit', month: '2-digit',
  })
}

/** Vorschau-Text für die Job-Karte, oder null wenn nichts anzuzeigen ist. */
export function nextRunPreview(job: Job): string | null {
  if (!job.enabled) return 'Keine Buchung geplant'
  if (!job.next_run_at || !job.next_class_date) return 'Wird beim nächsten Worker-Lauf eingeplant'
  return `Bucht ${formatRunAt(job.next_run_at)} Uhr für den Kurs am ${formatClassDate(job.next_class_date)}`
}
