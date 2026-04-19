import { useState } from 'react'
import LoginModal from '../components/LoginModal'

export default function LandingPage() {
  const [modalOpen, setModalOpen] = useState(false)

  function openModal() { setModalOpen(true) }
  function closeModal() { setModalOpen(false) }

  return (
    <div className="min-h-screen bg-surface-page">

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-20 bg-surface-page border-b border-slate-700/60">
        <div className="px-4 max-w-5xl mx-auto flex justify-between items-center py-4">
          <img src="/logo.png" alt="Logo" className="h-10 w-auto sm:h-14" />
          <button
            onClick={openModal}
            className="bg-brand hover:bg-brand-hover text-white font-semibold rounded-lg px-5 py-2 transition-colors"
          >
            Anmelden
          </button>
        </div>
      </nav>

      <div className="pt-20 sm:pt-24">

        {/* Hero */}
        <section className="max-w-5xl mx-auto px-4 py-16 flex flex-col sm:flex-row items-center gap-10">
          <div className="flex-1">
            <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-4">
              Nie wieder<br />
              <span className="text-brand-hover">Buchung verpassen.</span>
            </h1>
            <p className="text-slate-400 text-base leading-relaxed mb-8">
              Richte deine Eversports-Buchungen einmal ein – die App bucht
              automatisch jede Woche zur richtigen Zeit.
            </p>
            <button
              onClick={openModal}
              className="bg-brand hover:bg-brand-hover text-white font-semibold rounded-xl px-6 py-3 transition-colors"
            >
              Jetzt anmelden →
            </button>
          </div>

          {/* Screenshot 1 Platzhalter */}
          <div className="flex-shrink-0 w-full sm:w-72 h-48 bg-surface-card border border-slate-700/60 rounded-xl flex flex-col items-center justify-center text-slate-600 gap-2">
            <span className="text-3xl">📷</span>
            <span className="text-sm">Screenshot 1</span>
          </div>
        </section>

        <hr className="border-slate-700/60 max-w-5xl mx-auto" />

        {/* Video-Sektion */}
        <section className="max-w-5xl mx-auto px-4 py-14">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-hover mb-2">
            So funktioniert's
          </p>
          <h2 className="text-2xl font-bold text-white mb-2">
            Einmal einrichten, jede Woche profitieren
          </h2>
          <p className="text-slate-400 text-sm leading-relaxed mb-6 max-w-xl">
            Wähle Kurs, Uhrzeit und Wochentag – die App erledigt den Rest vollautomatisch.
          </p>

          {/* Video Platzhalter */}
          <div className="w-full h-56 sm:h-72 bg-surface-card border border-slate-700/60 rounded-xl flex flex-col items-center justify-center text-slate-600 gap-3">
            <div className="w-12 h-12 rounded-full bg-brand flex items-center justify-center text-white text-lg">
              ▶
            </div>
            <span className="text-sm">Video-Platzhalter</span>
          </div>
        </section>

        <hr className="border-slate-700/60 max-w-5xl mx-auto" />

        {/* Screenshot 2 */}
        <section className="max-w-5xl mx-auto px-4 py-14 flex flex-col sm:flex-row items-center gap-10">
          <div className="flex-1">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-hover mb-2">
              Übersicht behalten
            </p>
            <h2 className="text-2xl font-bold text-white mb-2">
              Alle Buchungen auf einen Blick
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Sieh alle geplanten Buchungen, aktiviere oder pausiere sie
              jederzeit – direkt in der App.
            </p>
          </div>

          {/* Screenshot 2 Platzhalter */}
          <div className="flex-shrink-0 w-full sm:w-72 h-44 bg-surface-card border border-slate-700/60 rounded-xl flex flex-col items-center justify-center text-slate-600 gap-2">
            <span className="text-3xl">📷</span>
            <span className="text-sm">Screenshot 2</span>
          </div>
        </section>

        {/* Footer CTA */}
        <section className="bg-surface-card border-t border-slate-700/60 text-center py-14 px-4">
          <h2 className="text-2xl font-bold text-white mb-2">Bereit loszulegen?</h2>
          <p className="text-slate-400 text-sm mb-6">Melde dich mit deinen Eversports-Daten an.</p>
          <button
            onClick={openModal}
            className="bg-brand hover:bg-brand-hover text-white font-semibold rounded-xl px-8 py-3 transition-colors"
          >
            Anmelden
          </button>
        </section>

      </div>

      {/* Login Modal */}
      {modalOpen && <LoginModal onClose={closeModal} />}
    </div>
  )
}
