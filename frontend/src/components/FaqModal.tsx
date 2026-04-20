const FAQ_ITEMS = [
  {
    question: 'Wie viele Buchungen kann ich planen?',
    answer:
      'Du kannst beliebig viele Buchungen (Jobs) anlegen. Jeder Job steht für einen wiederkehrenden Termin – z.B. jeden Montag um 18 Uhr Yoga bei Anbieter X. Es gibt keine Obergrenze.',
  },
  {
    question: 'Werden alle Anbieter, Kurse und Klassen bei Eversports unterstützt?',
    answer:
      'Die App funktioniert mit allen Anbietern und Kursen, die über Eversports buchbar sind. Voraussetzung ist, dass du bei dem jeweiligen Anbieter bereits ein Konto hast und eine gültige Mitgliedschaft oder ausreichend Credits besitzt – die App bucht in deinem Namen, kann aber keine fehlenden Berechtigungen umgehen.',
  },
  {
    question: 'Was sind einmalige Buchungen?',
    answer:
      'Bei einer einmaligen Buchung wird der Job nach der ersten erfolgreichen Buchung automatisch gelöscht. Das ist nützlich, wenn du nur einen einzelnen Termin automatisieren möchtest, ohne einen dauerhaften wiederkehrenden Job anzulegen.',
  },
  {
    question: 'Wie werden meine Zugangsdaten gespeichert?',
    answer:
      'Dein Eversports-Passwort wird verschlüsselt in der Datenbank gespeichert und nie im Klartext abgelegt. Die App verwendet deine Daten ausschließlich, um Buchungen in deinem Namen durchzuführen – sie werden nicht weitergegeben.',
  },
  {
    question: 'Welche E-Mails erhalte ich?',
    answer:
      'Du erhältst eine E-Mail, wenn eine Buchung fehlschlägt – z.B. weil der Kurs bereits ausgebucht ist, deine Mitgliedschaft abgelaufen ist oder es ein technisches Problem gab. Bei erfolgreichen Buchungen bekommst du eine Bestätigungs-E-Mail direkt von Eversports.',
  },
]

interface Props {
  onClose: () => void
}

export default function FaqModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60"
      data-testid="faq-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[80vh] overflow-y-auto bg-surface-card border border-slate-700/60 rounded-xl p-6 flex flex-col gap-4"
        data-testid="faq-modal-card"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Häufig gestellte Fragen</h2>
          <button
            type="button"
            aria-label="Schließen"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-2">
          {FAQ_ITEMS.map(({ question, answer }) => (
            <details
              key={question}
              className="group border border-slate-700/60 rounded-lg"
            >
              <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-white select-none flex justify-between items-center gap-2">
                {question}
                <span className="text-slate-400 group-open:rotate-180 transition-transform shrink-0">▾</span>
              </summary>
              <p className="px-4 pb-4 pt-1 text-sm text-slate-400 leading-relaxed">
                {answer}
              </p>
            </details>
          ))}
        </div>
      </div>
    </div>
  )
}
