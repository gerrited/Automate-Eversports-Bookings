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
      'Dein Eversports-Passwort wird mit AES-256-GCM verschlüsselt und ausschließlich in verschlüsselter Form in der Datenbank abgelegt – nie im Klartext. AES-256-GCM ist ein modernes AEAD-Verfahren (Authenticated Encryption with Associated Data): Es garantiert gleichzeitig Vertraulichkeit und Integrität, ohne ein separates HMAC zu benötigen. Der 256-Bit-Schlüssel wird serverseitig als Umgebungsvariable verwaltet und ist nicht Teil der Datenbank. Zum Durchführen einer Buchung wird das Passwort temporär entschlüsselt und direkt an die Eversports-API übergeben – es verlässt den Server dabei nicht.',
  },
  {
    question: 'Welche E-Mails erhalte ich?',
    answer:
      'Du erhältst eine E-Mail, wenn eine Buchung fehlschlägt – z.B. weil der Kurs bereits ausgebucht ist, deine Mitgliedschaft abgelaufen ist oder es ein technisches Problem gab. Bei erfolgreichen Buchungen bekommst du eine Bestätigungs-E-Mail direkt von Eversports.',
  },
  {
    question: 'Wie funktioniert die Anmeldung?',
    answer:
      'Die Anmeldung bei FOReversports erfolgt direkt mit deinen bestehenden Eversports-Zugangsdaten – ein separates Konto ist nicht erforderlich. Beim ersten Login werden deine Daten gegen Eversports geprüft und anschließend automatisch ein Konto für dich angelegt. Sobald die Anmeldung erfolgreich war, siehst du das Dashboard mit all deinen geplanten Buchungen. Wichtig: Wenn du dein Eversports-Passwort änderst, musst du dich danach auch einmal kurz bei FOReversports neu anmelden, damit deine gespeicherten Zugangsdaten aktualisiert werden – andernfalls schlagen automatische Buchungen fehl.',
  },
  {
    question: 'Wie kann ich mein Konto bei FOReversports löschen?',
    answer:
      'Du kannst dein Konto jederzeit selbst löschen. Öffne dazu das Menü oben rechts und wähle Einstellungen. Dort findest du die Option zum Löschen deines Kontos. Dabei werden deine gespeicherten Eversports-Zugangsdaten, alle geplanten Buchungen sowie dein Benutzerkonto vollständig und unwiderruflich entfernt.',
  },
]

import { useState } from 'react'

interface Props {
  onClose: () => void
}

export default function FaqModal({ onClose }: Props) {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

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
          {FAQ_ITEMS.map(({ question, answer }, index) => {
            const isOpen = openIndex === index
            return (
              <div key={question} className="border border-slate-700/60 rounded-lg">
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  className="w-full cursor-pointer px-4 py-3 text-sm font-medium text-white select-none flex justify-between items-center gap-2 text-left"
                >
                  {question}
                  <span className={`text-slate-400 transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                </button>
                {isOpen && (
                  <p className="px-4 pb-4 pt-1 text-sm text-slate-400 leading-relaxed">
                    {answer}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
