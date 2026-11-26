// Spiegelt compute_next_run() aus backend/core/schedule.py für die Vorschau
// auf der Landing Page: Lauf um `time` (Europe/Berlin) an dem Tag, der
// `daysInAdvance` Tage vor dem Kurstag (`weekday`, 0=Mo … 6=So) liegt.
// Maßgeblich bleibt das Backend – diese Funktion dient nur der Anzeige.

const TZ = 'Europe/Berlin'
const DAY_MS = 86_400_000

const partsFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
})

/** Berliner Wanduhrzeit eines Zeitpunkts, als "naive" UTC-Millisekunden. */
function berlinWallMs(instant: Date): number {
  const p: Record<string, number> = {}
  for (const { type, value } of partsFormatter.formatToParts(instant)) {
    if (type !== 'literal') p[type] = Number(value)
  }
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second)
}

/** Wandelt eine Berliner Wanduhrzeit (naive UTC-ms) in einen echten Zeitpunkt. */
function berlinWallToInstant(wall: number): Date {
  const offsetAt = (t: number) => berlinWallMs(new Date(t)) - Math.floor(t / 1000) * 1000
  let t = wall - offsetAt(wall)
  t = wall - offsetAt(t)
  return new Date(t)
}

const mod = (n: number, m: number) => ((n % m) + m) % m

export interface BookingWindow {
  /** Zeitpunkt, an dem die Buchung öffnet (= Lauf des Workers). */
  opening: Date
  /** Beginn des Kurses. */
  course: Date
}

export function nextBookingWindow(weekday: number, time: string, daysInAdvance: number, now: Date = new Date()): BookingWindow {
  const [hour, minute] = time.split(':').map(Number)
  const nowWall = berlinWallMs(now)
  const today = new Date(nowWall)
  const y = today.getUTCFullYear()
  const m = today.getUTCMonth()
  const d = today.getUTCDate()
  const todayWeekday = mod(today.getUTCDay() - 1, 7)

  const runWeekday = mod(weekday - daysInAdvance, 7)
  let ahead = mod(runWeekday - todayWeekday, 7)
  let opening = berlinWallToInstant(Date.UTC(y, m, d + ahead, hour, minute))
  if (opening.getTime() <= now.getTime()) {
    ahead += 7
    opening = berlinWallToInstant(Date.UTC(y, m, d + ahead, hour, minute))
  }
  const course = berlinWallToInstant(Date.UTC(y, m, d + ahead + daysInAdvance, hour, minute))
  return { opening, course }
}

const dateFormatter = new Intl.DateTimeFormat('de-DE', { timeZone: TZ, weekday: 'long', day: '2-digit', month: '2-digit' })
const timeFormatter = new Intl.DateTimeFormat('de-DE', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })

/** z. B. "Donnerstag, 27.11." */
export function formatDay(d: Date): string {
  return dateFormatter.format(d)
}

/** z. B. "18:00" */
export function formatTime(d: Date): string {
  return timeFormatter.format(d)
}

export interface Countdown {
  days: number
  hours: number
  minutes: number
  seconds: number
}

export function countdown(target: Date, now: Date): Countdown {
  const total = Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000))
  return {
    days: Math.floor(total / (DAY_MS / 1000)),
    hours: Math.floor(total / 3600) % 24,
    minutes: Math.floor(total / 60) % 60,
    seconds: total % 60,
  }
}
