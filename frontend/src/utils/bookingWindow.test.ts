import { nextBookingWindow, countdown, formatDay, formatTime } from './bookingWindow'

describe('nextBookingWindow', () => {
  it('liegt days_in_advance Tage vor dem Kurstag zur Kurszeit', () => {
    // Mittwoch, 26.11.2025, 12:00 Berlin (CET, UTC+1)
    const now = new Date('2025-11-26T11:00:00Z')
    // Kurs Montag 18:00, 4 Tage vorher → Donnerstag 27.11. 18:00
    const { opening, course } = nextBookingWindow(0, '18:00', 4, now)
    expect(opening.toISOString()).toBe('2025-11-27T17:00:00.000Z')
    expect(course.toISOString()).toBe('2025-12-01T17:00:00.000Z')
    expect(formatDay(opening)).toBe('Donnerstag, 27.11.')
    expect(formatTime(opening)).toBe('18:00')
  })

  it('springt eine Woche weiter, wenn der Lauf heute schon vorbei ist', () => {
    // Donnerstag, 27.11.2025, 18:00 Berlin – Lauf genau jetzt → strikt danach
    const now = new Date('2025-11-27T17:00:00Z')
    const { opening } = nextBookingWindow(0, '18:00', 4, now)
    expect(opening.toISOString()).toBe('2025-12-04T17:00:00.000Z')
  })

  it('läuft am selben Tag, wenn die Uhrzeit noch bevorsteht', () => {
    const now = new Date('2025-11-27T16:59:00Z')
    const { opening } = nextBookingWindow(0, '18:00', 4, now)
    expect(opening.toISOString()).toBe('2025-11-27T17:00:00.000Z')
  })

  it('ist DST-fest (Sommerzeit, UTC+2)', () => {
    // Montag, 23.03.2026 10:00 Berlin (CET); Kurs Mittwoch 09:00, 7 Tage vorher → Mi 25.03.
    const now = new Date('2026-03-23T09:00:00Z')
    const { opening, course } = nextBookingWindow(2, '09:00', 7, now)
    expect(opening.toISOString()).toBe('2026-03-25T08:00:00.000Z') // CET
    expect(course.toISOString()).toBe('2026-04-01T07:00:00.000Z') // CEST
  })
})

describe('countdown', () => {
  it('zerlegt die Restzeit', () => {
    const now = new Date('2025-01-01T00:00:00Z')
    const target = new Date(now.getTime() + ((26 * 60 + 3) * 60 + 9) * 1000)
    expect(countdown(target, now)).toEqual({ days: 1, hours: 2, minutes: 3, seconds: 9 })
  })

  it('wird nie negativ', () => {
    const now = new Date('2025-01-01T00:00:00Z')
    expect(countdown(new Date(0), now)).toEqual({ days: 0, hours: 0, minutes: 0, seconds: 0 })
  })
})
