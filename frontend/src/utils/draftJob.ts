// Übergabe eines auf der Landing Page geplanten Termins an das Dashboard.
// sessionStorage überlebt die Navigation nach dem Login im selben Tab,
// verschwindet aber mit dem Tab – es wird nichts dauerhaft gespeichert.

export interface JobDraft {
  weekday: number
  target_time: string // "HH:MM"
  days_in_advance: number
}

const KEY = 'jobDraft'

export function saveJobDraft(draft: JobDraft): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(draft))
  } catch {
    // Speicher nicht verfügbar (z. B. privater Modus) – dann ohne Vorbelegung.
  }
}

/** Liest den Entwurf und entfernt ihn – er wird genau einmal übernommen. */
export function takeJobDraft(): JobDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    sessionStorage.removeItem(KEY)
    const d = JSON.parse(raw) as Partial<JobDraft>
    const valid =
      Number.isInteger(d.weekday) && d.weekday! >= 0 && d.weekday! <= 6 &&
      typeof d.target_time === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(d.target_time) &&
      Number.isInteger(d.days_in_advance) && d.days_in_advance! >= 1 && d.days_in_advance! <= 30
    return valid ? (d as JobDraft) : null
  } catch {
    return null
  }
}
