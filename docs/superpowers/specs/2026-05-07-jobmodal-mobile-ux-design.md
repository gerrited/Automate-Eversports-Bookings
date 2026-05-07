# JobModal Mobile UX — Design Spec

**Datum:** 2026-05-07  
**Status:** Genehmigt

## Ziel

Das Buchungsformular (`JobModal.tsx`) für die mobile Nutzung optimieren: weniger vertikaler Platz, weniger Tastatureinsatz, schnellere Bedienung per Tap.

## Entschiedene Design-Änderungen

### 1. Inline Labels

Alle Formularfelder wechseln vom aktuellen "Label oben, Eingabe darunter"-Pattern auf ein Inline-Label-Pattern:

- Label links (feste Breite `80px`, `flex-shrink: 0`, Farbe `text-slate-500`, Schriftgröße `text-xs`)
- Eingabe/Control rechts, nimmt den restlichen Platz ein
- Jede Zeile ist eine zusammenhängende Einheit (`bg-surface-input`, `rounded-lg`, `py-2 px-3`)
- Vertikaler Abstand zwischen Zeilen: `gap-2` (statt bisherigem `gap-4`)

### 2. WeekdaySelector — neue ui/-Komponente

**Datei:** `frontend/src/components/ui/WeekdaySelector.tsx`

- 7 Buttons nebeneinander mit Beschriftung: `M D M D F S S` (Einzelbuchstaben)
- Buttons sind horizontal scrollbar (`overflow-x: auto`, kein sichtbarer Scrollbalken), linksbündig
- Aktiver Tag: `bg-brand text-white`, inaktiv: `bg-surface-card text-slate-500 border border-[#0d3336]`
- Button-Größe: `30×30px`, `border-radius: 6px`, `font-weight: 700`
- **Longpress-Tooltip:** Nach 500ms Halten erscheint ein Tooltip **oberhalb des Buttons** mit dem ausgeschriebenen Wochentagsnamen (z.B. „Mittwoch"). Der Longpress löst **keine** Auswahl aus — nur `pointerdown`/`pointerup`-Logik, kein `click`.
- Tooltip verschwindet beim Loslassen (`pointerup` / `pointercancel`) oder nach 1,5s automatisch
- Props: `value: number` (0=Mo … 6=So), `onChange: (day: number) => void`

### 3. Stepper — neue ui/-Komponente

**Datei:** `frontend/src/components/ui/Stepper.tsx`

- Layout: `[−] [Zahl] [+]` nebeneinander, linksbündig in der Inline-Label-Zeile
- `−` und `+` sind Buttons (`30×30px`)
- Die Zahl in der Mitte (`min-width: 32px`) ist antippbar: Tap ersetzt die statische Zahlanzeige in-place durch ein `<input type="number">` (gleiche Position, gleiche Breite), Tastatur öffnet sich
- Direkteingabe verlässt den Edit-Modus bei `blur` oder `Enter`; der Wert wird auf `[min, max]` geclippt und als Zahl gespeichert; leere Eingabe wird verworfen (alter Wert bleibt)
- Props: `value: number`, `onChange: (n: number) => void`, `min: number`, `max: number`

### 4. Uhrzeit — unverändert

`<input type="time">` ist bereits implementiert und öffnet auf Mobile den nativen OS-Zeitwähler. Keine Änderung notwendig.

## Dateien die geändert werden

| Datei | Art der Änderung |
|---|---|
| `frontend/src/components/ui/WeekdaySelector.tsx` | Neu |
| `frontend/src/components/ui/Stepper.tsx` | Neu |
| `frontend/src/components/ui/index.ts` | Export der zwei neuen Komponenten |
| `frontend/src/components/JobModal.tsx` | Formular auf Inline-Labels umgestellt, `<select>` → `<WeekdaySelector>`, `<Input type="number">` → `<Stepper>` |

## Nicht in diesem Scope

- **Bottom Sheet auf Mobile:** `ModalShell` soll in einem separaten Schritt als Bottom Sheet (von unten einfahrend) umgebaut werden, damit das Formular bei geöffneter Tastatur nicht verdeckt wird. (Gesondert geplant.)
- Tests für die neuen Komponenten sind ein separater Schritt nach der Implementierung.

## Visuelles Referenz

Mockups liegen unter `.superpowers/brainstorm/` im Projektverzeichnis (nicht eingecheckt).
