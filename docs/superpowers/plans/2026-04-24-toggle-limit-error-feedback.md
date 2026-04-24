# Toggle-Limit-Fehlermeldung — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wenn das Aktivieren eines Jobs wegen `max_active_jobs`-Limit fehlschlägt (HTTP 409), zeigt `JobCard` eine rote Fehlermeldung im `feedback`-Bereich an.

**Architecture:** In `JobCard.tsx` ersetzt eine neue async Funktion `handleToggle` den Inline-Handler am Toggle-Button. Sie fängt Fehler aus `onToggle` ab und setzt den bestehenden `feedback`-State — genau wie `handleExecute` bei einem fehlgeschlagenen Buchungsversuch. Der Prop-Typ von `onToggle` ändert sich auf `Promise<void>`. `DashboardPage.tsx` bleibt unverändert.

**Tech Stack:** React, TypeScript, Vitest, @testing-library/react

---

## Betroffene Dateien

| Aktion | Datei |
|--------|-------|
| Ändern | `frontend/src/components/JobCard.tsx` |
| Ändern | `frontend/src/components/JobCard.test.tsx` |

---

### Task 1: Toggle-Fehlerbehandlung in `JobCard`

**Files:**
- Modify: `frontend/src/components/JobCard.tsx:5-12` (Props-Interface)
- Modify: `frontend/src/components/JobCard.tsx:94-108` (Toggle-Button)
- Modify: `frontend/src/components/JobCard.test.tsx` (bestehender + neuer Test)

- [ ] **Step 1: Failing-Test für Fehlermeldung schreiben**

  In `frontend/src/components/JobCard.test.tsx` nach dem letzten `it`-Block innerhalb des `describe('onExecute', ...)` Blocks, aber **außerhalb** davon (auf der obersten `describe`-Ebene) einfügen:

  ```tsx
  it('zeigt Fehlermeldung wenn onToggle fehlschlägt', async () => {
    const onToggle = vi.fn().mockRejectedValue(new Error('Limit von 3 aktiven Buchungen erreicht.'))
    render(
      <JobCard job={job} onToggle={onToggle} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('switch'))
    })
    expect(screen.getByText(/Limit von 3 aktiven Buchungen erreicht/)).toBeInTheDocument()
  })
  ```

- [ ] **Step 2: Test ausführen — muss fehlschlagen**

  ```bash
  cd frontend && npx vitest run src/components/JobCard.test.tsx --reporter=verbose 2>&1 | tail -20
  ```

  Erwartete Ausgabe: `FAIL` — der Test findet keinen Fehlertext, weil `handleToggle` noch nicht existiert.

- [ ] **Step 3: `onToggle`-Prop-Typ auf `Promise<void>` ändern**

  In `frontend/src/components/JobCard.tsx` Zeile 7 ändern:

  ```tsx
  interface Props {
    job: Job
    onToggle: (id: string) => Promise<void>
    onEdit: (job: Job) => void
    onDelete: (id: string) => void
    onSelect: (job: Job) => void
    onExecute?: (id: string) => Promise<{ status: string; message: string }>
  }
  ```

- [ ] **Step 4: `handleToggle`-Funktion nach `handleExecute` einfügen**

  In `frontend/src/components/JobCard.tsx` nach dem Ende der `handleExecute`-Funktion (nach Zeile 55) einfügen:

  ```tsx
  async function handleToggle() {
    try {
      await onToggle(job.id)
    } catch (err) {
      if (mountedRef.current) {
        setFeedback({ status: 'failed', message: err instanceof Error ? err.message : 'Fehler beim Umschalten' })
        timerRef.current = setTimeout(() => setFeedback(null), 10000)
      }
    }
  }
  ```

- [ ] **Step 5: Toggle-Button `onClick` auf `handleToggle` umstellen**

  In `frontend/src/components/JobCard.tsx` Zeile 98 ändern:

  ```tsx
  onClick={e => { e.stopPropagation(); handleToggle() }}
  ```

  Der vollständige Toggle-Button sieht danach so aus:

  ```tsx
  <button
    role="switch"
    aria-checked={job.enabled}
    onClick={e => { e.stopPropagation(); handleToggle() }}
    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
      job.enabled ? 'bg-green-700' : 'bg-slate-600'
    }`}
  >
    <span
      className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform mt-1 ${
        job.enabled ? 'translate-x-6' : 'translate-x-1'
      }`}
    />
  </button>
  ```

- [ ] **Step 6: Bestehenden Toggle-Test auf async aktualisieren**

  In `frontend/src/components/JobCard.test.tsx` den Test `'calls onToggle when toggle is clicked'` (aktuell Zeile 45–52) ersetzen:

  ```tsx
  it('calls onToggle when toggle is clicked', async () => {
    const onToggle = vi.fn().mockResolvedValue(undefined)
    render(
      <JobCard job={job} onToggle={onToggle} onEdit={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />
    )
    await act(async () => {
      fireEvent.click(screen.getByRole('switch'))
    })
    expect(onToggle).toHaveBeenCalledWith('job-1')
  })
  ```

  **Hinweis:** Alle anderen Tests übergeben `onToggle={vi.fn()}`. Das ist weiterhin gültig — `vi.fn()` gibt `undefined` zurück, `await undefined` ist in JS erlaubt und löst sofort auf. Diese Tests brauchen keine weiteren Änderungen.

- [ ] **Step 7: Alle JobCard-Tests ausführen — müssen grün sein**

  ```bash
  cd frontend && npx vitest run src/components/JobCard.test.tsx --reporter=verbose 2>&1 | tail -30
  ```

  Erwartete Ausgabe: Alle Tests `✓ PASS`, inkl. `zeigt Fehlermeldung wenn onToggle fehlschlägt`.

- [ ] **Step 8: Gesamte Frontend-Test-Suite ausführen**

  ```bash
  cd frontend && npm test 2>&1 | tail -20
  ```

  Erwartete Ausgabe: Alle Tests `PASS`, keine Regressionen.

- [ ] **Step 9: TypeScript-Compilierung prüfen**

  ```bash
  cd frontend && npx tsc --noEmit 2>&1
  ```

  Erwartete Ausgabe: Keine Fehler.

- [ ] **Step 10: Commit**

  ```bash
  git add frontend/src/components/JobCard.tsx frontend/src/components/JobCard.test.tsx
  git commit -m "feat: show error feedback when toggle hits job limit"
  ```
