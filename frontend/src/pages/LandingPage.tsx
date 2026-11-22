import { useState, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import LoginModal from '../components/LoginModal'
import FaqModal from '../components/FaqModal'
import Logo, { LogoMark } from '../components/Logo'

const ROTATING_TEXTS = ['eine Klasse verpassen.', 'einen Kurs verpassen.', 'ein Training verpassen.']
const VIDEO_URL = 'https://www.youtube.com/watch?v=spngnOZDBQo'

const PRIMARY_BTN =
  'inline-flex items-center justify-center gap-2.5 rounded-2xl bg-brand text-white font-bold transition-[background-color,transform,box-shadow] duration-150 hover:bg-brand-hover hover:-translate-y-px hover:shadow-[0_10px_30px_rgba(0,67,73,.45)]'
const EYEBROW = 'text-sm font-bold uppercase tracking-[0.14em] text-accent'
const H2 = 'text-[34px] sm:text-[44px] lg:text-[54px] leading-[1.08] font-extrabold tracking-[-0.03em] text-white'
const LEAD = 'text-lg sm:text-[19px] leading-relaxed text-muted'

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

function MockField({ label, children, highlight = false }: { label: string; children: ReactNode; highlight?: boolean }) {
  return (
    <div className="flex flex-col gap-[7px] min-w-0 flex-1">
      <span className="text-[13px] font-semibold text-muted">{label}</span>
      <span
        className={`flex items-center justify-between rounded-xl bg-[#0b252b] px-4 py-[13px] text-base font-medium text-[#f2f7f7] ${highlight ? 'border border-accent py-3 px-[15px]' : ''}`}
      >
        {children}
      </span>
    </div>
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

const STEPS = [
  { title: 'Mit Eversports anmelden', text: 'Einfach mit deinen gewohnten Eversports-Daten einloggen – kein neues Konto nötig.' },
  { title: 'Kurs, Tag und Uhrzeit wählen', text: 'Lege fest, welche Klasse du jede Woche besuchen willst und wie viele Tage im Voraus gebucht wird.' },
  { title: 'Die App bucht für dich', text: 'Sobald die Buchung öffnet, sichert FOREversports deinen Platz – Woche für Woche, ganz automatisch.' },
]

export default function LandingPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [faqOpen, setFaqOpen] = useState(false)
  const [textIdx, setTextIdx] = useState(0)
  const [visible, setVisible] = useState(true)
  const pendingIdx = useRef(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false)
      pendingIdx.current = (textIdx + 1) % ROTATING_TEXTS.length
    }, 3000)
    return () => clearInterval(interval)
  }, [textIdx])

  useEffect(() => {
    if (visible) return
    const t = setTimeout(() => {
      setTextIdx(pendingIdx.current)
      setVisible(true)
    }, 250)
    return () => clearTimeout(t)
  }, [visible])

  function openModal() { setModalOpen(true) }
  function closeModal() { setModalOpen(false) }

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
          <a href="/" aria-label="Startseite"><Logo /></a>
          <div className="flex items-center gap-7">
            <a href="#so-funktionierts" className="hidden md:inline text-[15px] font-medium text-muted hover:text-[#f2f7f7] transition-colors">So funktioniert’s</a>
            <a href="#uebersicht" className="hidden md:inline text-[15px] font-medium text-muted hover:text-[#f2f7f7] transition-colors">Übersicht</a>
            <button type="button" onClick={() => setFaqOpen(true)} className="hidden md:inline text-[15px] font-medium text-muted hover:text-[#f2f7f7] transition-colors">FAQ</button>
            <button type="button" onClick={openModal} className={`${PRIMARY_BTN} min-h-[46px] px-5 sm:px-[22px] rounded-[14px] text-base`}>
              Anmelden
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative">
        <div aria-hidden className="pointer-events-none absolute left-1/2 -top-[340px] w-[1100px] h-[700px] -ml-[150px] rounded-full bg-brand opacity-[.28] blur-[140px]" />
        <div className="relative max-w-[1200px] mx-auto px-4 sm:px-6 pt-14 pb-20 lg:pt-24 lg:pb-28 flex flex-col lg:flex-row items-center gap-14 lg:gap-16">
          <div className="lg:flex-[1.3] min-w-0 flex flex-col gap-7">
            <span className="self-start inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-[7px] text-[13px] font-bold uppercase tracking-[0.08em] text-accent">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>
              Fast · On-time · Reservations
            </span>
            <h1 className="text-[44px] sm:text-[60px] lg:text-[80px] leading-[1.02] font-extrabold tracking-[-0.035em] text-white">
              Nie wieder<br />
              <span
                className="text-accent inline-block"
                style={{
                  opacity: visible ? 1 : 0,
                  transform: visible ? 'translateY(0)' : 'translateY(-6px)',
                  transition: visible
                    ? 'opacity 300ms ease-in-out, transform 300ms ease-in-out'
                    : 'opacity 250ms ease-in-out, transform 250ms ease-in-out',
                }}
              >
                {ROTATING_TEXTS[textIdx]}
              </span>
            </h1>
            <p className="max-w-[540px] text-lg sm:text-xl leading-relaxed text-muted">
              Plane deine Eversports-Termine im Voraus und die App bucht sie immer automatisch für dich – pünktlich, sobald die Buchung öffnet.
            </p>
            <div className="flex flex-wrap gap-3.5 pt-1">
              <button type="button" onClick={openModal} className={`${PRIMARY_BTN} min-h-[58px] px-[30px] text-lg`}>
                Jetzt anmelden <ArrowIcon />
              </button>
              <a
                href="#so-funktionierts"
                className="inline-flex items-center min-h-[58px] px-[26px] rounded-2xl border border-[#1c3a40] text-lg font-semibold text-[#f2f7f7] hover:bg-white/5 hover:border-[#2b4e55] hover:text-[#f2f7f7] transition-colors"
              >
                So funktioniert’s
              </a>
            </div>
            <p className="flex items-center gap-2 text-sm text-faint">
              <LockIcon className="text-accent" />
              Anmeldung mit deinen bestehenden Eversports-Daten
            </p>
          </div>

          {/* Formular-Vorschau */}
          <div className="flex-1 min-w-0 w-full flex justify-center lg:justify-end">
            <div
              role="img"
              aria-label="Formular „Neue Buchung planen“ mit Einrichtung CrossFit Rabbit Hole, Kurs CrossFit, Montag, 18:00 Uhr, 4 Tage im Voraus"
              className="w-full max-w-[460px] rounded-3xl border border-line bg-surface-card p-6 sm:p-7 shadow-[0_40px_100px_rgba(0,0,0,.5)] flex flex-col gap-[18px]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-xl font-extrabold text-white">Neue Buchung planen</span>
                <span className="w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_0_5px_rgba(46,184,166,.18)] animate-pulse" />
              </div>
              <MockField label="Einrichtung">CrossFit Rabbit Hole</MockField>
              <MockField label="Kursname" highlight>CrossFit</MockField>
              <div className="flex flex-wrap gap-3">
                <MockField label="Wochentag">
                  Montag
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6" /></svg>
                </MockField>
                <MockField label="Uhrzeit">
                  <span className="tabular-nums">18:00</span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>
                </MockField>
              </div>
              <MockField label="Tage im Voraus">4 Tage</MockField>
              <span className="mt-1 flex items-center justify-center min-h-[52px] rounded-[14px] bg-brand text-base font-bold text-white">Buchung speichern</span>
            </div>
          </div>
        </div>
      </header>

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

      {/* CTA */}
      <section className="relative overflow-hidden border-t border-line-subtle px-4 sm:px-6 py-24 lg:py-[120px]">
        <div aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 w-[900px] h-[420px] -ml-[450px] -mt-[210px] rounded-full bg-brand opacity-30 blur-[120px]" />
        <div className="relative max-w-[720px] mx-auto flex flex-col items-center gap-[22px] text-center">
          <LogoMark className="h-9 w-auto" strokeWidth={2.2} />
          <h2 className="text-[38px] sm:text-[50px] lg:text-[62px] leading-[1.05] font-extrabold tracking-[-0.035em] text-white">Bereit loszulegen?</h2>
          <p className="text-lg sm:text-xl leading-relaxed text-muted">Melde dich mit deinen Eversports-Daten an und plane deine erste Buchung in wenigen Minuten.</p>
          <button type="button" onClick={openModal} className={`${PRIMARY_BTN} mt-2 min-h-[60px] px-9 text-[19px]`}>
            Anmelden <ArrowIcon />
          </button>
        </div>
      </section>

      {modalOpen && <LoginModal onClose={closeModal} />}
      {faqOpen && <FaqModal onClose={() => setFaqOpen(false)} />}
    </div>
  )
}
