# Help Icons für JobModal

## Ziel

Neben jedem Eingabefeld im JobModal (Erstellen und Bearbeiten von geplanten Buchungen) erscheint ein `?`-Icon. Ein Klick/Touch darauf öffnet ein Popup mit einem erklärenden Hilfetext.

## Komponente: HelpIcon

**Datei:** `frontend/src/components/HelpIcon.tsx`

**Props:**
- `text: string` — der anzuzeigende Hilfetext

**Verhalten:**
- Rendert einen kleinen runden `?`-Button (16×16px, Slate-Farbe, passend zum bestehenden UI)
- Eigener `open: boolean`-State
- Klick auf den Button togglet das Popup
- Klick außerhalb des Popups schließt es (`useEffect` mit `document` click listener + `useRef` auf den Container)
- Nur ein Popup kann gleichzeitig offen sein (wird durch den document-Listener sichergestellt — jede Instanz schließt sich selbst bei Außen-Klick)

**Popup-Styling:**
- `position: absolute`, unterhalb des Icons (`top: 100%`), rechtsbündig am Icon ausgerichtet
- Breite: 220px
- Dunkles Styling: `bg-[#1e293b]`, `border border-slate-700`, `rounded-lg`, `shadow-xl`
- Text: `text-slate-300 text-xs`, Titel fett in `text-white`
- Z-Index hoch genug, um über Formularfeldern zu liegen

## Änderungen in JobModal

**Datei:** `frontend/src/components/JobModal.tsx`

`<HelpIcon text="..." />` wird neben dem Label-Text jedes Feldes eingefügt:

| Feld | Hilfetext |
|------|-----------|
| Anbieter | "Der Sportanbieter, bei dem du den Kurs buchen möchtest." |
| Wochentag | "Der Wochentag, an dem der Kurs regelmäßig stattfindet." |
| Uhrzeit | "Die Startzeit des Kurses. Wird auch genutzt, um passende Kurse in der Auswahl zu filtern." |
| Kursname | "Der Name des Kurses, der gebucht werden soll. Leer lassen, um den ersten verfügbaren Kurs zu diesem Zeitpunkt zu buchen." |
| Tage im Voraus | "Wie viele Tage vor dem Kurs soll die Buchung ausgelöst werden? Eversports öffnet Buchungsslots typischerweise einige Tage im Voraus — stelle den Wert passend zum Anbieter ein." |
| Einmalig | "Aktiviert: nur einmal ausführen, dann automatisch löschen. Deaktiviert: jede Woche wiederholen." |
| Test (Admin) | "Testmodus — die Buchung wird sofort nach Abschluss wieder storniert." |

## Nicht im Scope

- Andere Modals (LoginModal, SettingsModal) — kein Hilfetext erforderlich
- Animationen/Transitions für das Popup
- Keyboard-Navigation (z.B. Escape zum Schließen)
