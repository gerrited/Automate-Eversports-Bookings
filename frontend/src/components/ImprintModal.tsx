interface Props {
  onClose: () => void
}

export default function ImprintModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/60"
      data-testid="imprint-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[80vh] overflow-y-auto bg-surface-card border border-slate-700/60 rounded-xl p-6 flex flex-col gap-6"
        data-testid="imprint-modal-card"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Impressum & Datenschutz</h2>
          <button
            type="button"
            aria-label="Schließen"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <section className="flex flex-col gap-3">
          <h3 className="text-base font-semibold text-white border-b border-slate-700/60 pb-2">Impressum</h3>
          <p className="text-xs text-slate-500">Anbieterkennzeichnung gemäß § 5 DDG</p>
          <div className="text-sm text-slate-300 leading-relaxed">
            <p>Gerrit Edzards</p>
            <p>Bussardweg 86</p>
            <p>26133 Oldenburg</p>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Kontakt</p>
            <p className="text-sm text-slate-300">E-Mail: hi@foreversports.cc</p>
            <p className="text-sm text-slate-300">
              Webseite:{' '}
              <a
                href="https://www.foreversports.cc/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-slate-300 hover:text-white underline underline-offset-2"
              >
                www.foreversports.cc
              </a>
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Verantwortlich für den Inhalt</p>
            <p className="text-sm text-slate-300">Gerrit Edzards (Anschrift wie oben)</p>
          </div>

          <div className="flex flex-col gap-1">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">Haftungsausschluss</p>
            <p className="text-sm text-slate-400 leading-relaxed">
              Dieses Web-Angebot ist ein rein privates Hobby-Projekt für einen geschlossenen Nutzerkreis
              (Freunde & Familie). Es dient der vereinfachten Verwaltung von Buchungen beim Drittanbieter
              Eversports. Es besteht keinerlei geschäftliche Verbindung, Partnerschaft oder offizielle
              Kooperation mit der Eversports GmbH.
            </p>
            <p className="text-sm text-slate-400 leading-relaxed mt-2">
              Trotz sorgfältiger technischer Umsetzung erfolgt die Nutzung auf
              eigene Gefahr. Für etwaige Fehler bei Buchungen oder den Verlust von Zugangsdaten im Rahmen
              der Nutzung dieses inoffiziellen Tools wird keine Haftung übernommen.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="text-base font-semibold text-white border-b border-slate-700/60 pb-2">Datenschutzerklärung</h3>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">1. Datenschutz auf einen Blick</p>
              <p className="text-sm text-slate-400 leading-relaxed">
                Wir nehmen den Schutz Ihrer persönlichen Daten sehr ernst. Da dieses Tool Zugangsdaten
                für einen Drittanbieter (Eversports) verarbeitet, informieren wir Sie hier transparent
                über den Umgang mit Ihren Daten.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">2. Datenerfassung und Infrastruktur</p>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-slate-300">Hosting (Self-Hosted)</p>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Die Anwendungslogik dieser Webseite wird auf privater Infrastruktur in Deutschland betrieben.
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-slate-300">Cloudflare Tunnel</p>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Zur sicheren Bereitstellung der Webseite nutzen wir „Cloudflare Tunnel" (Cloudflare Inc.,
                  USA). Hierbei wird der Datenverkehr verschlüsselt über das Netzwerk von Cloudflare
                  geleitet, wobei IP-Adressen zur Abwehr von Angriffen verarbeitet werden können.
                </p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-medium text-slate-300">Datenbank (Supabase)</p>
                <p className="text-sm text-slate-400 leading-relaxed">
                  Zur Speicherung von Nutzerprofilen und verschlüsselten Anmeldedaten nutzen wir Supabase.
                  Die Daten werden in der Region EU-Central (Frankfurt, Deutschland) gespeichert. Supabase
                  verarbeitet Daten als Auftragsverarbeiter unter Einhaltung strenger Sicherheitsstandards.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">3. Verarbeitung von Eversports-Zugangsdaten</p>
              <p className="text-sm text-slate-400 leading-relaxed">
                Das Kernstück dieses Projekts ist die Verwaltung von Eversports-Buchungen. Dazu werden
                Ihre Zugangsdaten (E-Mail/Passwort) wie folgt verarbeitet:
              </p>
              <div className="flex flex-col gap-2 pl-3 border-l border-slate-700/60">
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium text-slate-300">Verschlüsselung</p>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Alle Passwörter werden mittels AES-256 verschlüsselt gespeichert. Der Entschlüsselungs-Key
                    wird sicher verwaltet und ist nicht für Dritte zugänglich.
                  </p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium text-slate-300">Verwendung</p>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Die Daten werden automatisiert genutzt, um Aktionen über die offizielle Eversports-API
                    sowie durch Web-Scraping des Eversports-Interfaces in Ihrem Namen auszuführen.
                  </p>
                </div>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium text-slate-300">Übermittlung</p>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Ihre Zugangsdaten werden im Rahmen des Logins an die Server der Eversports GmbH übertragen.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">4. Ihre Rechte</p>
              <p className="text-sm text-slate-400 leading-relaxed">
                Sie haben jederzeit das Recht auf die Löschung Ihrer Daten. Da
                Konten manuell freigeschaltet werden, genügt vor der Freigabe eine kurze Nachricht an den Betreiber, um
                Ihr Konto und alle hinterlegten verschlüsselten Daten unwiderruflich zu löschen. Nach der Freigabe können Sie Ihre Daten jederzeit über die Kontoeinstellungen löschen.
              </p>
            </div>
          </div>
        </section>

        <p className="text-xs text-slate-600 text-center">
          Erstellt für das private Projekt foreversports.cc | Stand: Mai 2026
        </p>
      </div>
    </div>
  )
}
