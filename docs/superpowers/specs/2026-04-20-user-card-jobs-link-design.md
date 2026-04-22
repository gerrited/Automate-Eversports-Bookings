# Design: Benutzer-Karte Buchungen-Link

**Datum:** 2026-04-20

## Feature

Ein Klick auf "x Buchungen" auf einer Benutzer-Karte im Benutzer-Tab wechselt zum Buchungen-Tab und füllt den E-Mail-Filter mit der E-Mail-Adresse des Benutzers vor.

## Architektur

### State-Flow

`DashboardPage` verwaltet den Tab-übergreifenden Filter-State. Ein Klick auf "x Buchungen" in `UserManagementSection` ruft einen Callback auf, der sowohl den aktiven Tab als auch den E-Mail-Filter in `DashboardPage` setzt, welcher dann als Prop an `AllJobsSection` weitergegeben wird.

### Änderungen pro Komponente

**`DashboardPage`**
- State hinzufügen: `const [jobsEmailFilter, setJobsEmailFilter] = useState('')`
- Handler hinzufügen:
  ```ts
  function handleUserJobsClick(email: string) {
    setJobsEmailFilter(email)
    setActiveTab('jobs')
  }
  ```
- `onJobsClick={handleUserJobsClick}` an `<UserManagementSection>` übergeben
- `initialEmailFilter={jobsEmailFilter}` an `<AllJobsSection>` übergeben

**`UserManagementSection`**
- Optionales Prop hinzufügen: `onJobsClick?: (email: string) => void`
- `{user.job_count} Buchungen` als `<button>` rendern, wenn `onJobsClick` definiert und `job_count > 0`
- Button-Styling: `text-brand underline cursor-pointer` zur Anzeige der Interaktivität
- Bei `job_count === 0`: als Plain Text belassen (nicht klickbar, nichts zu navigieren)

**`AllJobsSection`**
- Optionales Prop hinzufügen: `initialEmailFilter?: string`
- `useEffect` hinzufügen, der den internen `emailFilter`-State synchronisiert, wenn sich `initialEmailFilter` ändert:
  ```ts
  useEffect(() => {
    if (initialEmailFilter !== undefined) {
      setEmailFilter(initialEmailFilter)
      setCurrentPage(1)
    }
  }, [initialEmailFilter])
  ```

## Datenfluss

```
UserManagementSection
  └─ Button-Klick → onJobsClick(email)
        ↓
DashboardPage
  ├─ setJobsEmailFilter(email)
  └─ setActiveTab('jobs')
        ↓
AllJobsSection
  └─ initialEmailFilter prop → synchronisiert internen emailFilter-State
```

## Randfälle

- `job_count === 0`: "0 Buchungen" bleibt Plain Text, kein klickbarer Button
- Filter wird beim Tab-Wechsel zurückgesetzt: Nein — der Filter bleibt bis der Benutzer ihn manuell löscht oder eine andere E-Mail auswählt
- `initialEmailFilter` ändert sich von außen: `useEffect` in `AllJobsSection` reagiert darauf und setzt Filter + Seite zurück

## Nicht im Scope

- Zurücknavigieren vom Buchungen-Tab zur Benutzer-Karte
- Filter-State in URL persistieren
