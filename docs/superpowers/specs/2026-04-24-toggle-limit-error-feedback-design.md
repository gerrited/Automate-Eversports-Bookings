# Design: Fehlermeldung bei Toggle-Limit-Überschreitung

**Datum:** 2026-04-24

## Zusammenfassung

Wenn das Aktivieren eines Jobs wegen des `max_active_jobs`-Limits fehlschlägt (HTTP 409), zeigt `JobCard` eine Fehlermeldung im bestehenden `feedback`-Bereich an — genau wie bei einem fehlgeschlagenen "Jetzt buchen"-Aufruf.

---

## Betroffene Dateien

| Aktion | Datei |
|--------|-------|
| Ändern | `frontend/src/components/JobCard.tsx` |

`DashboardPage.tsx` bleibt unverändert.

---

## Änderungen in `JobCard.tsx`

### Prop-Typ

`onToggle` wird von synchron auf async geändert:

```ts
// vorher
onToggle: (id: string) => void
// nachher
onToggle: (id: string) => Promise<void>
```

### Neuer Handler `handleToggle`

Ersetzt den direkten Inline-Handler am Toggle-Button:

```ts
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

Der Toggle-Button ruft `handleToggle` statt dem Inline-Handler auf:

```tsx
onClick={e => { e.stopPropagation(); handleToggle() }}
```

### Verhalten

- **Fehler (HTTP 409):** `feedback` wird auf `{ status: 'failed', message: 'Limit von X aktiven Buchungen erreicht.' }` gesetzt → roter Text im `feedback`-Bereich, verschwindet nach 10 Sekunden
- **Erfolg:** Kein `feedback` — der Toggle-Switch selbst zeigt den neuen Zustand
- **Kein Spinner / disabled-State** nötig: Der Toggle ist eine schnelle Aktion

---

## Datenfluss

```
Toggle-Button onClick
  → handleToggle()
    → await onToggle(job.id)        ← DashboardPage.handleToggle (async, kein catch)
      → await toggleJob(id)         ← apiFetch → HTTP 409 → wirft Error("Limit von X ...")
    ← Error propagiert zurück
  → catch: setFeedback({ status: 'failed', message })
  → setTimeout 10s → setFeedback(null)
```

---

## Was nicht geändert wird

- `DashboardPage.tsx` — `handleToggle` ist bereits async, kein catch nötig
- `feedback`-Styling — bestehende CSS-Klassen für `failed` Status werden wiederverwendet
- `apiFetch` — wirft bereits `Error` mit `body.detail` bei nicht-OK-Responses
