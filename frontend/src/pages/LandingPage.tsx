import { useState, useEffect, useRef, useId } from 'react'
import type { ReactNode, RefObject } from 'react'
import LoginModal from '../components/LoginModal'
import FaqModal from '../components/FaqModal'
import Logo from '../components/Logo'
import { Stepper } from '../components/ui'
import { WEEKDAY_NAMES } from '../types'
import { nextBookingWindow, countdown, formatDay, formatTime } from '../utils/bookingWindow'
import { saveJobDraft } from '../utils/draftJob'

const VIDEO_URL = 'https://www.youtube.com/watch?v=spngnOZDBQo'
const WEEKDAY_SHORT = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

const PRIMARY_BTN =
  'inline-flex items-center justify-center gap-2.5 rounded-2xl bg-brand text-white font-bold transition-[background-color,transform,box-shadow] duration-150 hover:bg-brand-hover hover:-translate-y-px hover:shadow-[0_10px_30px_rgba(0,67,73,.45)]'
const ACCENT_BTN =
  'inline-flex items-center justify-center gap-2.5 rounded-2xl bg-accent text-surface-page font-extrabold transition-[background-color,transform,box-shadow] duration-150 hover:bg-accent-hover hover:-translate-y-px hover:shadow-[0_14px_40px_rgba(46,184,166,.35)]'
const EYEBROW = 'text-sm font-bold uppercase tracking-[0.14em] text-accent'
const H2 = 'text-[34px] sm:text-[44px] lg:text-[54px] leading-[1.08] font-extrabold tracking-[-0.03em] text-white'
const LEAD = 'text-lg sm:text-[19px] leading-relaxed text-muted'

interface Plan {
  weekday: number
  time: string
  days: number
}

function ArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function LockIcon({ className = '' }: { className?: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <rect x="4" y="10.5" width="16" height="10" rx="2.5" />
      <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-accent shrink-0">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  )
}

function CrossIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="text-red-400 shrink-0">
      <path d="M7 7l10 10M17 7L7 17" />
    </svg>
  )
}

function MockJob({ title, sub, active }: { title: string; sub: string; active: boolean }) {
  return (
    <div className="rounded-2xl border border-line-subtle bg-[#071f24] px-5 py-[18px] flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <span className="flex flex-col gap-1 min-w-0">
          <span className={`text-base sm:text-[17px] font-bold ${active ? 'text-white' : 'text-muted'}`}>{title}</span>
          <span className={`text-sm ${active ? 'text-muted' : 'text-faint'}`}>{sub}</span>
        </span>
        <span className={`relative shrink-0 w-[46px] h-[26px] rounded-full ${active ? 'bg-green-600' : 'bg-slate-700'}`}>
          <span className={`absolute top-[3px] w-5 h-5 rounded-full ${active ? 'right-[3px] bg-white' : 'left-[3px] bg-slate-300'}`} />
        </span>
      </div>
      <div className="flex justify-between gap-3">
        <span className="rounded-lg bg-slate-700 px-3 py-1.5 text-[13px] font-semibold text-slate-200">Bearbeiten</span>
        <span className="rounded-lg bg-red-800 px-3 py-1.5 text-[13px] font-semibold text-red-100">Löschen</span>
      </div>
    </div>
  )
}

function TimeTile({ value, label }: { value: number; label: string }) {
  return (
    <span className="flex-1 min-w-0 flex flex-col items-center gap-1 rounded-xl border border-accent/25 bg-[#061a1f] py-2.5 sm:py-3">
      <span className="text-[26px] sm:text-[32px] leading-none font-extrabold tabular-nums text-white">
        {String(value).padStart(2, '0')}
      </span>
      <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-faint">{label}</span>
    </span>
  )
}

function TimelineItem({ when, children, tone }: { when: string; children: ReactNode; tone: 'muted' | 'accent' | 'brand' }) {
  const dot =
    tone === 'accent'
      ? 'bg-accent shadow-[0_0_0_5px_rgba(46,184,166,.2)] animate-pulse'
      : tone === 'brand'
        ? 'bg-white'
        : 'bg-slate-400'
  return (
    <li className="relative flex gap-3.5 pb-4 last:pb-0">
      <span aria-hidden className="relative flex flex-col items-center pt-[5px]">
        <span className={`w-2.5 h-2.5 rounded-full ${dot}`} />
      </span>
      <span className="flex flex-col gap-0.5 min-w-0">
        <span className="text-[13px] font-bold uppercase tracking-[0.08em] text-faint">{when}</span>
        <span className="text-[15px] leading-snug text-[#d5dee6]">{children}</span>
      </span>
    </li>
  )
}

/** Interaktive Planung direkt auf der Landing Page – ohne Login. */
function BookingPlanner({ plan, onChange, onCommit }: { plan: Plan; onChange: (p: Plan) => void; onCommit: () => void }) {
  const ids = useId()
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const validTime = /^\d{2}:\d{2}$/.test(plan.time)
  const win = validTime ? nextBookingWindow(plan.weekday, plan.time, plan.days, now) : null
  const left = win ? countdown(win.opening, now) : null

  return (
    <div
      id="planer"
      className="scroll-mt-28 relative w-full max-w-[520px] rounded-[28px] border border-accent/30 ring-1 ring-white/[.03] bg-surface-card/95 p-5 sm:p-7 shadow-[0_40px_120px_rgba(0,0,0,.55)] flex flex-col gap-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-accent">Probier’s aus – ohne Login</span>
          <h2 id={`${ids}-title`} className="text-[22px] sm:text-2xl font-extrabold tracking-[-0.02em] text-white">Wann ist dein Kurs?</h2>
        </div>
      </div>

      <div role="group" aria-labelledby={`${ids}-wd`} className="flex flex-col gap-2">
        <span id={`${ids}-wd`} className="text-[13px] font-semibold text-muted">Wochentag</span>
        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAY_SHORT.map((d, i) => {
            const on = plan.weekday === i
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={WEEKDAY_NAMES[i]}
                onClick={() => onChange({ ...plan, weekday: i })}
                className={`min-h-11 rounded-xl text-[15px] font-bold transition-[background-color,color,box-shadow] ${
                  on
                    ? 'bg-accent text-surface-page shadow-[0_6px_20px_rgba(46,184,166,.35)]'
                    : 'bg-surface-input text-slate-200 hover:bg-surface-raised'
                }`}
              >
                {d}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="flex flex-col gap-2 flex-[1_1_140px] min-w-0">
          <label htmlFor={`${ids}-time`} className="text-[13px] font-semibold text-muted">Kursbeginn</label>
          <input
            id={`${ids}-time`}
            type="time"
            value={plan.time}
            onChange={e => e.target.value && onChange({ ...plan, time: e.target.value })}
            className="min-h-11 rounded-xl border border-line bg-surface-input px-3.5 text-[17px] font-bold tabular-nums text-white outline-none [color-scheme:dark] focus:border-accent focus:shadow-[0_0_0_4px_rgba(46,184,166,.18)]"
          />
        </div>
        <div className="flex flex-col gap-2 flex-[1_1_180px] min-w-0">
          <span id={`${ids}-days`} className="text-[13px] font-semibold text-muted">Buchung öffnet … vorher</span>
          <div className="flex items-center gap-3">
            <Stepper
              aria-label="Tage im Voraus"
              value={plan.days}
              onChange={days => onChange({ ...plan, days })}
              min={1}
              max={30}
            />
            <span className="text-sm text-muted">{plan.days === 1 ? 'Tag' : 'Tage'}</span>
          </div>
        </div>
      </div>

      {win && left && (
        <div className="rounded-2xl border border-line-subtle bg-[#05181c] p-4 sm:p-5 flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className="text-[13px] font-semibold text-muted">Nächster Buchungsstart</span>
            <span className="text-lg sm:text-xl font-extrabold text-white">
              {formatDay(win.opening)} · {formatTime(win.opening)} Uhr
            </span>
          </div>

          <p className="sr-only">
            Die Buchung öffnet in {left.days} Tagen, {left.hours} Stunden und {left.minutes} Minuten.
          </p>
          <div aria-hidden className="flex gap-2">
            <TimeTile value={left.days} label="Tage" />
            <TimeTile value={left.hours} label="Std" />
            <TimeTile value={left.minutes} label="Min" />
            <TimeTile value={left.seconds} label="Sek" />
          </div>

          <ol className="flex flex-col">
            <TimelineItem when="Jetzt" tone="muted">Einmal einrichten – dauert eine Minute.</TimelineItem>
            <TimelineItem when={`${formatDay(win.opening)} · ${formatTime(win.opening)}`} tone="accent">
              <strong className="font-bold text-white">Buchung öffnet.</strong> FOREversports bucht automatisch für dich.
            </TimelineItem>
            <TimelineItem when={`${formatDay(win.course)} · ${formatTime(win.course)}`} tone="brand">
              Du gehst zum Training. Dein Platz ist sicher.
            </TimelineItem>
          </ol>
        </div>
      )}

      <button type="button" onClick={onCommit} className={`${ACCENT_BTN} min-h-[58px] px-6 text-[17px]`}>
        Diesen Kurs automatisch buchen <ArrowIcon />
      </button>
      <p className="-mt-2 flex items-center justify-center gap-2 text-[13px] text-faint text-center">
        <LockIcon className="text-accent shrink-0" />
        Danach nur noch mit Eversports anmelden – dein Plan wird übernommen.
      </p>
    </div>
  )
}

const STEPS = [
  { title: 'Mit Eversports anmelden', text: 'Einfach mit deinen gewohnten Eversports-Daten einloggen – kein neues Konto nötig.' },
  { title: 'Kurs, Tag und Uhrzeit wählen', text: 'Lege fest, welche Klasse du jede Woche besuchen willst und wie viele Tage im Voraus gebucht wird.' },
  { title: 'Die App bucht für dich', text: 'Sobald die Buchung öffnet, sichert FOREversports deinen Platz – Woche für Woche, ganz automatisch.' },
]

const WITHOUT = [
  'Wecker stellen, nur um pünktlich zu buchen',
  'Im Meeting oder unterwegs – Buchungsstart verpasst',
  'Kurs voll, Warteliste statt Training',
  'Und nächste Woche das gleiche Spiel',
]

const WITH = [
  'Einmal einrichten, fertig',
  'Gebucht wird automatisch, sobald die Buchung öffnet',
  'Bestätigung kommt wie gewohnt von Eversports',
  'Im Urlaub einfach pausieren',
]

/** Beobachtet, ob ein Element sichtbar ist oder schon nach oben weggescrollt wurde. */
function useScrollState(ref: RefObject<HTMLElement | null>) {
  const [state, setState] = useState<'before' | 'visible' | 'past'>('visible')
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([entry]) => {
      setState(entry.isIntersecting ? 'visible' : entry.boundingClientRect.top < 0 ? 'past' : 'before')
    })
    io.observe(el)
    return () => io.disconnect()
  }, [ref])
  return state
}

export default function LandingPage() {
  const [modal, setModal] = useState<'none' | 'login' | 'plan'>('none')
  const [faqOpen, setFaqOpen] = useState(false)
  const [plan, setPlan] = useState<Plan>({ weekday: 0, time: '18:00', days: 4 })

  const heroRef = useRef<HTMLElement>(null)
  const ctaRef = useRef<HTMLElement>(null)
  const heroState = useScrollState(heroRef)
  const ctaState = useScrollState(ctaRef)
  const showStickyBar = heroState === 'past' && ctaState === 'before'

  const weekdayName = WEEKDAY_NAMES[plan.weekday]

  function commitPlan() {
    saveJobDraft({ weekday: plan.weekday, target_time: plan.time, days_in_advance: plan.days })
    setModal('plan')
  }

  return (
    <div className="bg-surface-page text-[#f2f7f7] overflow-x-clip">
      <div aria-hidden style={{ height: 'var(--notice-height, 0px)' }} />

      {/* Navigation */}
      <nav
        aria-label="Hauptnavigation"
        className="sticky z-20 border-b border-line-subtle bg-surface-page/90 backdrop-blur-md"
        style={{ top: 'var(--notice-height, 0px)' }}
      >
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-3.5 sm:py-[18px] flex items-center justify-between gap-4">
          <a href="/" aria-label="Startseite"><Logo alt="" /></a>
          <div className="flex items-center gap-4 sm:gap-7">
            <a href="#planer" className="hidden md:inline-flex items-center min-h-6 text-[15px] font-medium text-muted hover:text-[#f2f7f7] transition-colors">Planen</a>
            <a href="#so-funktionierts" className="hidden md:inline-flex items-center min-h-6 text-[15px] font-medium text-muted hover:text-[#f2f7f7] transition-colors">So funktioniert’s</a>
            <a href="#uebersicht" className="hidden lg:inline-flex items-center min-h-6 text-[15px] font-medium text-muted hover:text-[#f2f7f7] transition-colors">Übersicht</a>
            <button type="button" onClick={() => setFaqOpen(true)} className="inline-flex items-center min-h-6 text-[15px] font-medium text-muted hover:text-[#f2f7f7] transition-colors">FAQ</button>
            <button type="button" onClick={() => setModal('login')} className={`${PRIMARY_BTN} min-h-[46px] px-5 sm:px-[22px] rounded-[14px] text-base`}>
              Anmelden
            </button>
          </div>
        </div>
      </nav>

      <main>
      {/* Hero mit Planer */}
      <section ref={heroRef} className="relative">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[.35] [background-image:linear-gradient(rgba(46,184,166,.07)_1px,transparent_1px),linear-gradient(90deg,rgba(46,184,166,.07)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:radial-gradient(ellipse_at_70%_30%,#000_20%,transparent_70%)]" />
        <div aria-hidden className="pointer-events-none absolute left-1/2 -top-[340px] w-[1100px] h-[700px] -ml-[150px] rounded-full bg-brand opacity-[.32] blur-[140px]" />
        <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 pt-12 pb-20 lg:pt-20 lg:pb-28 flex flex-col lg:flex-row items-center gap-12 lg:gap-14">
          <div className="lg:flex-[1.1] min-w-0 flex flex-col gap-7">
            <span className="self-start inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-[7px] text-[13px] font-bold uppercase tracking-[0.08em] text-accent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>
              Fast · On-time · Reservations
            </span>
            <h1 className="text-[46px] sm:text-[64px] lg:text-[82px] leading-[1] font-extrabold tracking-[-0.04em] text-white">
              Kurs voll?<br />
              <span className="bg-[linear-gradient(90deg,#2eb8a6,#5fd6c5)] bg-clip-text text-transparent">Nicht für dich.</span>
            </h1>
            <p className="max-w-[540px] text-lg sm:text-xl leading-relaxed text-muted">
              FOREversports bucht deine Eversports-Kurse automatisch – in dem Moment, in dem die Buchung öffnet.
              Du stellst es einmal ein, wir buchen jede Woche.
            </p>
            <ul className="flex flex-wrap gap-x-6 gap-y-3 text-[15px] font-medium text-[#d5dee6]">
              <li className="flex items-center gap-2"><CheckIcon />Dein Eversports-Login genügt</li>
              <li className="flex items-center gap-2"><CheckIcon />Jederzeit pausierbar</li>
              <li className="flex items-center gap-2"><CheckIcon />Open Source</li>
            </ul>
            <a href="#planer" className={`${ACCENT_BTN} lg:hidden self-stretch sm:self-start min-h-[56px] px-7 text-[17px]`}>
              Jetzt Kurs planen
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>
            </a>
            <div className="hidden lg:flex flex-wrap items-center gap-5 pt-1">
              <a
                href="#so-funktionierts"
                className="inline-flex items-center min-h-[52px] px-[22px] rounded-2xl border border-[#1c3a40] text-base font-semibold text-[#f2f7f7] hover:bg-white/5 hover:border-[#2b4e55] hover:text-[#f2f7f7] transition-colors"
              >
                So funktioniert’s
              </a>
              <a href={VIDEO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 min-h-6 text-base font-semibold text-muted hover:text-white transition-colors">
                <span aria-hidden className="w-8 h-8 rounded-full bg-accent/15 flex items-center justify-center">
                  <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="#2eb8a6" /></svg>
                </span>
                Video ansehen
              </a>
            </div>
          </div>

          <div className="flex-1 min-w-0 w-full flex justify-center lg:justify-end">
            <BookingPlanner plan={plan} onChange={setPlan} onCommit={commitPlan} />
          </div>
        </div>
      </section>

      {/* Ohne / Mit */}
      <section className="border-t border-line-subtle bg-surface-alt px-4 sm:px-6 py-20 lg:py-28">
        <div className="max-w-[1152px] mx-auto flex flex-col gap-12">
          <div className="max-w-[720px] flex flex-col gap-4">
            <span className={EYEBROW}>Das Problem</span>
            <h2 className={H2}>Beliebte Kurse sind schnell ausgebucht.</h2>
            <p className={LEAD}>Wer nicht genau zum Buchungsstart am Handy ist, landet auf der Warteliste. Das muss nicht sein.</p>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            <div className="rounded-3xl border border-line-subtle bg-surface-page p-6 sm:p-8 flex flex-col gap-5">
              <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-red-300">Ohne FOREversports</span>
              <ul className="flex flex-col gap-4">
                {WITHOUT.map(t => (
                  <li key={t} className="flex items-start gap-3 text-base sm:text-[17px] text-muted"><CrossIcon />{t}</li>
                ))}
              </ul>
            </div>
            <div className="relative rounded-3xl border border-accent/40 bg-[linear-gradient(160deg,rgba(0,67,73,.55),rgba(7,28,33,1)_60%)] p-6 sm:p-8 flex flex-col gap-5 shadow-[0_30px_80px_rgba(0,67,73,.35)]">
              <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-accent">Mit FOREversports</span>
              <ul className="flex flex-col gap-4">
                {WITH.map(t => (
                  <li key={t} className="flex items-start gap-3 text-base sm:text-[17px] font-medium text-white"><CheckIcon />{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* So funktioniert's */}
      <section id="so-funktionierts" className="scroll-mt-24 border-t border-line-subtle px-4 sm:px-6 py-20 lg:py-28">
        <div className="max-w-[1152px] mx-auto flex flex-col gap-12 lg:gap-14">
          <div className="max-w-[720px] flex flex-col gap-4">
            <span className={EYEBROW}>So funktioniert’s</span>
            <h2 className={H2}>Einmal einrichten, jede Woche profitieren</h2>
            <p className={LEAD}>Wähle einfach Kurs, Wochentag sowie Uhrzeit – die App erledigt den Rest vollautomatisch.</p>
          </div>
          <div className="flex flex-col lg:flex-row gap-12 lg:gap-14 lg:items-center">
            <ol className="flex-1 min-w-0 flex flex-col gap-7">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-5">
                  <span
                    className={`shrink-0 w-12 h-12 rounded-[14px] flex items-center justify-center text-lg font-extrabold ${i === STEPS.length - 1 ? 'bg-accent text-surface-page' : 'bg-brand text-white'}`}
                  >
                    {i + 1}
                  </span>
                  <span className="flex flex-col gap-1.5">
                    <span className="text-xl font-bold text-white">{step.title}</span>
                    <span className="text-base leading-relaxed text-muted">{step.text}</span>
                  </span>
                </li>
              ))}
            </ol>
            <a
              href={VIDEO_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Demo-Video auf YouTube ansehen"
              className="group flex-[1.3] min-w-0 relative flex flex-col justify-between gap-8 min-h-[300px] sm:min-h-[340px] p-7 rounded-3xl border border-line bg-surface-card overflow-hidden text-[#f2f7f7] hover:text-[#f2f7f7]"
            >
              <div aria-hidden className="absolute inset-0 bg-brand opacity-[.22]" />
              <div className="relative flex flex-col gap-1">
                <span className="text-[13px] font-bold uppercase tracking-[0.1em] text-accent">Video</span>
                <span className="text-[22px] font-extrabold text-white">FOREversports – Fastest On-time Reservations</span>
                <span className="text-[15px] text-muted">Eine kurze Tour durch die App</span>
              </div>
              <span className="relative self-center w-[84px] h-[84px] rounded-full bg-accent flex items-center justify-center shadow-[0_16px_50px_rgba(0,0,0,.45)] transition-transform duration-200 group-hover:scale-[1.06]">
                <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="#04151A" /></svg>
              </span>
              <span className="relative flex items-center gap-2 text-[15px] font-semibold">
                Auf YouTube ansehen
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" /></svg>
              </span>
            </a>
          </div>
        </div>
      </section>

      {/* Übersicht */}
      <section id="uebersicht" className="scroll-mt-24 border-t border-line-subtle bg-surface-alt px-4 sm:px-6 py-20 lg:py-28">
        <div className="max-w-[1152px] mx-auto flex flex-col lg:flex-row gap-12 lg:gap-16 lg:items-center">
          <div className="flex-1 min-w-0 flex flex-col gap-4">
            <span className={EYEBROW}>Übersicht behalten</span>
            <h2 className={H2}>Alle Buchungen auf einen Blick</h2>
            <p className={LEAD}>Sieh alle geplanten Buchungen, aktiviere oder pausiere sie jederzeit – direkt in der App.</p>
            <ul className="flex flex-col gap-3 pt-3">
              {['Pausieren statt löschen, z. B. im Urlaub', 'Termine jederzeit bearbeiten', 'Mehrere Kurse pro Woche planen'].map(t => (
                <li key={t} className="flex items-center gap-3 text-base text-[#d5dee6]"><CheckIcon />{t}</li>
              ))}
            </ul>
          </div>
          <div className="flex-[1.2] min-w-0">
            <div
              role="img"
              aria-label="Liste geplanter Buchungen: Dienstag 18:00 CrossFit aktiv, Sonntag 09:00 CrossFit aktiv, Montag 18:00 CrossFit pausiert"
              className="rounded-3xl border border-line bg-surface-page p-4 sm:p-[22px] flex flex-col gap-3.5 shadow-[0_40px_100px_rgba(0,0,0,.4)]"
            >
              <span className="flex items-center justify-center min-h-[50px] rounded-[14px] bg-brand text-base font-bold text-white">+ Buchung planen</span>
              <MockJob title="Dienstag · 18:00 Uhr · CrossFit" sub="CrossFit Rabbit Hole · 4 Tage im Voraus" active />
              <MockJob title="Sonntag · 09:00 Uhr · CrossFit" sub="CrossFit Rabbit Hole · 4 Tage im Voraus" active />
              <MockJob title="Montag · 18:00 Uhr · CrossFit" sub="CrossFit Rabbit Hole · Pausiert" active={false} />
            </div>
          </div>
        </div>
      </section>

      {/* CTA – greift den geplanten Termin auf */}
      <section ref={ctaRef} className="relative overflow-hidden border-t border-line-subtle px-4 sm:px-6 py-24 lg:py-[120px]">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 w-[900px] h-[420px] -ml-[450px] -mt-[210px] rounded-full bg-brand opacity-30 blur-[120px]" />
        <div className="relative max-w-[760px] mx-auto flex flex-col items-center gap-[22px] text-center">
          <Logo size="lg" alt="" />
          <h2 className="text-[38px] sm:text-[50px] lg:text-[62px] leading-[1.05] font-extrabold tracking-[-0.035em] text-white">
            Dein {weekdayName} um <span className="text-accent tabular-nums">{plan.time}</span> Uhr wartet.
          </h2>
          <p className="text-lg sm:text-xl leading-relaxed text-muted">
            Melde dich mit deinen Eversports-Daten an – wir übernehmen deinen Plan, du suchst nur noch Anbieter und Kurs aus.
          </p>
          <div className="mt-2 flex flex-wrap justify-center gap-3.5">
            <button type="button" onClick={commitPlan} className={`${ACCENT_BTN} min-h-[60px] px-9 text-[19px]`}>
              Anmelden &amp; Plan übernehmen <ArrowIcon />
            </button>
            <a
              href="#planer"
              className="inline-flex items-center min-h-[60px] px-[26px] rounded-2xl border border-[#1c3a40] text-lg font-semibold text-[#f2f7f7] hover:bg-white/5 hover:border-[#2b4e55] hover:text-[#f2f7f7] transition-colors"
            >
              Plan ändern
            </a>
          </div>
        </div>
      </section>
      </main>

      {/* Mobile: Plan bleibt beim Scrollen greifbar */}
      <div
        aria-hidden={!showStickyBar}
        inert={!showStickyBar}
        className={`md:hidden fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface-page/95 backdrop-blur-md px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] transition-transform duration-300 ${
          showStickyBar ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="flex flex-col min-w-0">
            <span className="text-xs font-semibold text-faint">Dein Plan</span>
            <span className="text-[15px] font-bold text-white truncate">
              {weekdayName} · {plan.time} Uhr
            </span>
          </span>
          <button type="button" onClick={commitPlan} className={`${ACCENT_BTN} shrink-0 min-h-12 px-5 text-base rounded-xl`}>
            Automatisch buchen
          </button>
        </div>
      </div>

      {modal === 'login' && <LoginModal onClose={() => setModal('none')} />}
      {modal === 'plan' && (
        <LoginModal
          onClose={() => setModal('none')}
          title="Fast geschafft!"
          subtitle={`Melde dich mit deinen Eversports-Daten an – dein Plan (${weekdayName}, ${plan.time} Uhr, ${plan.days} ${plan.days === 1 ? 'Tag' : 'Tage'} vorher) wird direkt übernommen.`}
        />
      )}
      {faqOpen && <FaqModal onClose={() => setFaqOpen(false)} />}
    </div>
  )
}
