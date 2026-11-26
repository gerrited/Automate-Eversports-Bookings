import { saveJobDraft, takeJobDraft } from './draftJob'

beforeEach(() => sessionStorage.clear())

describe('draftJob', () => {
  it('übernimmt einen Entwurf genau einmal', () => {
    saveJobDraft({ weekday: 3, target_time: '07:30', days_in_advance: 6 })
    expect(takeJobDraft()).toEqual({ weekday: 3, target_time: '07:30', days_in_advance: 6 })
    expect(takeJobDraft()).toBeNull()
  })

  it('verwirft ungültige Daten', () => {
    sessionStorage.setItem('jobDraft', JSON.stringify({ weekday: 9, target_time: '7', days_in_advance: 0 }))
    expect(takeJobDraft()).toBeNull()
    sessionStorage.setItem('jobDraft', '{kaputt')
    expect(takeJobDraft()).toBeNull()
  })
})
