# Design: User Card Jobs Link

**Date:** 2026-04-20

## Feature

Clicking "x Jobs" on a user card in the Benutzer tab navigates to the Jobs tab and pre-fills the email filter with that user's email address.

## Architecture

### State Flow

`DashboardPage` owns the cross-tab filter state. Clicking "x Jobs" in `UserManagementSection` calls a callback that sets both the active tab and the email filter in `DashboardPage`, which then passes the filter down to `AllJobsSection` as a prop.

### Changes per Component

**`DashboardPage`**
- Add state: `const [jobsEmailFilter, setJobsEmailFilter] = useState('')`
- Add handler:
  ```ts
  function handleUserJobsClick(email: string) {
    setJobsEmailFilter(email)
    setActiveTab('jobs')
  }
  ```
- Pass `onJobsClick={handleUserJobsClick}` to `<UserManagementSection>`
- Pass `initialEmailFilter={jobsEmailFilter}` to `<AllJobsSection>`

**`UserManagementSection`**
- Add optional prop: `onJobsClick?: (email: string) => void`
- Render `{user.job_count} Jobs` as a `<button>` when `onJobsClick` is defined and `job_count > 0`
- Button styling: `text-brand underline cursor-pointer` to indicate interactivity
- When `job_count === 0`: keep as plain text (not clickable, nothing to navigate to)

**`AllJobsSection`**
- Add optional prop: `initialEmailFilter?: string`
- Add `useEffect` that syncs internal `emailFilter` state when `initialEmailFilter` changes:
  ```ts
  useEffect(() => {
    if (initialEmailFilter !== undefined) {
      setEmailFilter(initialEmailFilter)
      setCurrentPage(1)
    }
  }, [initialEmailFilter])
  ```

## Data Flow

```
UserManagementSection
  └─ button click → onJobsClick(email)
        ↓
DashboardPage
  ├─ setJobsEmailFilter(email)
  └─ setActiveTab('jobs')
        ↓
AllJobsSection
  └─ initialEmailFilter prop → syncs internal emailFilter state
```

## Edge Cases

- `job_count === 0`: "0 Jobs" bleibt Plain Text, kein klickbarer Button
- Filter wird beim Tab-Wechsel zurückgesetzt: Nein — der Filter bleibt bis der Nutzer ihn manuell löscht oder eine andere Email auswählt
- `initialEmailFilter` ändert sich von außen: `useEffect` in `AllJobsSection` reagiert darauf und setzt Filter + Seite zurück

## Out of Scope

- Zurücknavigieren vom Jobs-Tab zur Userkarte
- Filter-State in URL persistieren
