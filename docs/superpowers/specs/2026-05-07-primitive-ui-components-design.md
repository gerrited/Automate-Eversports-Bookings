# Design: Primitive UI-Komponenten

**Datum:** 2026-05-07

## Ziel

Wiederholte Tailwind-Klassen für Buttons, Inputs und Modale in ca. 14 Komponenten auf drei zentrale primitive Komponenten konsolidieren. Kein neues Paket, keine `className`-Escape-Hatches — alle Variationen werden über explizite Props gesteuert.

---

## Dateistruktur

```
src/components/ui/
├── Button.tsx
├── Input.tsx
├── ModalShell.tsx
└── index.ts
```

Alle drei Komponenten werden via `src/components/ui/index.ts` re-exportiert.

---

## Komponente: `Button`

### Props

```typescript
interface ButtonProps {
  variant: 'primary' | 'secondary' | 'danger' | 'slate'
  size?: 'sm' | 'md'
  loading?: boolean
  fullWidth?: boolean
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  'aria-label'?: string
  children: React.ReactNode
}
```

Defaults: `size='md'`, `type='button'`.

### Varianten

| Variante | Verwendung | Basis-Stil |
|---|---|---|
| `primary` | Speichern, Login, Senden, Schließen (nach Aktion) | `bg-brand hover:bg-brand-hover text-white font-semibold rounded-lg transition-colors` |
| `ghost` | Abbrechen in Modalen (inline, kein Rahmen) | `text-slate-400 hover:text-white transition-colors` |
| `secondary` | Pagination (← Zurück / Weiter →), Dialog-Abbrechen mit Rahmen | `bg-surface-card border border-slate-700 text-slate-400 hover:bg-slate-700 rounded-md transition-colors` |
| `danger` | Löschen, Deaktivieren, Limit setzen | `bg-red-900 hover:bg-red-700 text-red-300 rounded-lg transition-colors` |
| `slate` | Bearbeiten, neutrale In-Row-Aktionen (Nachricht senden) | `bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-md transition-colors` |

### Größen

| Größe | Padding | Verwendung |
|---|---|---|
| `sm` | `px-3 py-1 text-sm` | JobCard-Aktionen, Pagination, UserManagement-Zeile |
| `md` | `px-4 py-2 text-sm` | Modale |

### `disabled`-Verhalten

Alle Varianten: `disabled:opacity-50 disabled:cursor-not-allowed`.

### `loading`-Verhalten

Wenn `loading={true}`:
- Button ist implizit `disabled`
- Ein kleiner Spinner (`animate-spin`, `h-3 w-3`) erscheint links vor `children`
- `children`-Text bleibt sichtbar (kein Text-Wechsel nötig — der Aufrufer entscheidet über den Label-Text)

### `fullWidth`

Wenn `true`: `w-full` wird hinzugefügt.

### Sonderfälle (bleiben inline)

- **"Jetzt buchen"** in `JobCard`: blauer eigener Farbton + eigener Spinner-Zustand — bleibt als `<button>` direkt im JSX
- **"Buchung planen"** in `DashboardPage`: `flex-1 py-3 rounded-xl` (Layout-abhängig) — bleibt inline

### Danger-Vereinheitlichung

`SettingsModal` verwendet aktuell `bg-red-600 text-white`. Im Zuge der Migration wird das auf `danger` (`bg-red-900 text-red-300`) angepasst. Die Bestätigungspflicht ("DELETE" eintippen) ist das primäre Sicherheitssignal.

---

## Komponente: `Input`

### Props

```typescript
interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  variant?: 'default' | 'filter'
}
```

Alle nativen `<input>`-Props (`type`, `value`, `onChange`, `placeholder`, `required`, `min`, `max`, `autoFocus`, `onKeyDown`, `aria-label`, …) werden automatisch durchgereicht.

### Varianten

| Variante | Verwendung | Stil |
|---|---|---|
| `default` | Formular-Felder in Modalen | `bg-surface-input text-white rounded-lg px-3 py-2 outline-hidden focus:ring-2 focus:ring-brand` |
| `filter` | Suchfelder in Listen | `bg-surface-card border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500` |

Kein `w-full` in der Komponente — Breite wird durch den Container gesteuert (`flex-1`, `w-32`, etc.).

### Autofill & Color-Scheme

Beide Varianten erhalten immer:
- `[&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_var(--color-surface-input)_inset]`
- `[&:-webkit-autofill]:[-webkit-text-fill-color:white]`
- `[color-scheme:dark]`

Diese Klassen sind für Felder ohne Autofill oder ohne Zeit-Picker wirkungslos.

### Sonderfälle (bleiben inline)

- **Limit-Eingabefeld** in `UserManagementSection` (`w-12 px-1 py-0.5 text-xs`) — zu kontextspezifisch
- **`<textarea>`** im Nachrichten-Modal — eigener HTML-Tag, kein `<input>`

---

## Komponente: `ModalShell`

### Props

```typescript
interface ModalShellProps {
  onBackdropClick?: () => void
  maxWidth?: 'sm' | 'md'
  children: React.ReactNode
}
```

Default: `maxWidth='md'`.

### Struktur

```
<div>  ← fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4
         onClick={onBackdropClick}
  <div>  ← bg-surface-card border border-slate-700 rounded-xl w-full max-w-{size} p-6
           onClick stopPropagation
    {children}
  </div>
</div>
```

`border border-slate-700` wird immer gesetzt — einheitliche Tiefe für alle Modale.

### `onBackdropClick`

Optional. Fehlt es, ist das Modal nicht durch Klick auf den Backdrop schließbar (Einsatz: Bestätigungsdialoge wie `pendingLimit` in `UserManagementSection`).

### Sonderfälle

- `LoginModal`: nutzt `maxWidth="sm"`, passt internen Abstand von `p-8` auf `p-6` an
- `FaqModal` / `ImprintModal`: behalten internen Scroll-Container innerhalb von `children`

---

## Migrationsliste

| Datei | Button | Input | ModalShell |
|---|---|---|---|
| `LoginModal.tsx` | ✓ | ✓ | ✓ |
| `JobModal.tsx` | ✓ | ✓ | ✓ |
| `SettingsModal.tsx` | ✓ | ✓ | ✓ |
| `UserManagementSection.tsx` | ✓ | ✓ | ✓ (2×) |
| `AllLogsSection.tsx` | ✓ (Pagination) | ✓ | — |
| `AllJobsSection.tsx` | ✓ (Pagination) | ✓ | — |
| `JobCard.tsx` | ✓ (Edit + Delete) | — | — |
| `BookedAppointmentCard.tsx` | ✓ | — | — |
| `FacilityCombobox.tsx` | — | ✓ | — |
| `CourseCombobox.tsx` | — | ✓ | — |
| `TestEmailModal.tsx` | ✓ | — | ✓ |
| `FaqModal.tsx` | — | — | ✓ |
| `ImprintModal.tsx` | — | — | ✓ |
| `LogDrawer.tsx` | — | — | — |

---

## Sonderfälle ohne Migration

- **`LogDrawer.tsx`**: Der Error-Detail-Dialog nutzt `z-60` (über dem Drawer mit `z-50`). ModalShell würde den falschen z-Index setzen — bleibt vollständig inline.
- **`AllLogsSection.tsx` expandedMessage-Dialog**: Nutzt `z-50` und kann ModalShell verwenden.

## Nicht im Scope

- Auth Context Migration
- shadcn/ui oder andere externe UI-Bibliotheken
- `<select>`, `<textarea>`, Checkbox, Toggle — bleiben inline
