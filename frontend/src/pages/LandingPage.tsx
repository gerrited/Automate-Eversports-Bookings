import { useState } from 'react'
import LoginModal from '../components/LoginModal'

interface LightboxImage {
  src: string
  alt: string
}

export default function LandingPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [lightbox, setLightbox] = useState<LightboxImage | null>(null)

  function openModal() { setModalOpen(true) }
  function closeModal() { setModalOpen(false) }

  function openLightbox(src: string, alt: string) { setLightbox({ src, alt }) }
  function closeLightbox() { setLightbox(null) }

  return (
    <div className="min-h-screen bg-surface-page">

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-20 bg-surface-page border-b border-slate-700/60">
        <div className="px-4 max-w-5xl mx-auto flex justify-between items-center py-4">
          <a href="/"><img src="/logo.png" alt="Logo" className="h-10 w-auto sm:h-14" /></a>
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
              <span className="text-brand-hover">einen Kurs verpassen.</span>
            </h1>
            <p className="text-slate-400 text-base leading-relaxed mb-8">
              Plane deine Eversports-Termine im Voraus und die App bucht sie
              automatisch zur richtigen Zeit.
            </p>
            <button
              onClick={openModal}
              className="bg-brand hover:bg-brand-hover text-white font-semibold rounded-xl px-6 py-3 transition-colors whitespace-nowrap"
            >
              Jetzt anmelden →
            </button>
          </div>

          {/* Screenshot 1 */}
          <div
            className="flex-shrink-0 w-full sm:w-72 bg-surface-card border border-slate-700/60 rounded-xl overflow-hidden cursor-zoom-in"
            onClick={() => openLightbox('/new-booking.png', 'Screenshot - neue Buchung')}
          >
            <img src="/new-booking.png" alt="Screenshot - neue Buchung" className="w-full h-auto" />
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
            Wähle Kurs, Wochentag und Uhrzeit – die App erledigt den Rest vollautomatisch.
          </p>

          <div className="w-full aspect-video rounded-xl overflow-hidden border border-slate-700/60">
            <iframe
              src="https://www.youtube.com/embed/spngnOZDBQo"
              title="So funktioniert's"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
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
              Alle Buchungen auf einem Blick
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Sieh alle geplanten Buchungen, aktiviere oder pausiere sie
              jederzeit – direkt in der App.
            </p>
          </div>

          {/* Screenshot 2 */}
          <div
            className="flex-shrink-0 w-full sm:w-72 bg-surface-card border border-slate-700/60 rounded-xl overflow-hidden cursor-zoom-in"
            onClick={() => openLightbox('/overview.png', 'Screenshot - Buchungsübersicht')}
          >
            <img src="/overview.png" alt="Screenshot - Buchungsübersicht" className="w-full h-auto" />
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

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex flex-col items-center justify-center px-4"
          onClick={closeLightbox}
        >
          <img
            src={lightbox.src}
            alt={lightbox.alt}
            className="max-w-full max-h-[80vh] rounded-xl shadow-2xl"
            onClick={e => e.stopPropagation()}
          />
          <p className="mt-4 text-slate-300 text-sm">{lightbox.alt}</p>
        </div>
      )}

      {/* Login Modal */}
      {modalOpen && <LoginModal onClose={closeModal} />}
    </div>
  )
}
