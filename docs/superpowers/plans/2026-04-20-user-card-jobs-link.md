# User Card Jobs Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking "x Jobs" on a user card in the Benutzer tab navigates to the Jobs tab and pre-fills the email filter with that user's email address.

**Architecture:** `DashboardPage` lifts the cross-tab email filter state and provides a `handleUserJobsClick(email)` callback to `UserManagementSection`. The callback sets the tab and filter simultaneously. `AllJobsSection` receives `initialEmailFilter` as a prop and syncs its internal state via `useEffect`.

**Tech Stack:** React, TypeScript, React Router v6

---

### Task 1: `AllJobsSection` — `initialEmailFilter` prop

**Files:**
- Modify: `frontend/src/components/AllJobsSection.tsx`
- Modify: `frontend/src/components/AllJobsSection.test.tsx`

- [ ] **Step 1: Write the failing test**

Open `frontend/src/components/AllJobsSection.test.tsx` and add a test that verifies the component pre-fills the filter when `initialEmailFilter` is passed:

```tsx
it('pre-fills email filter from initialEmailFilter prop', async () => {
  const jobs = [
    {
      id: 1,
      user_email: 'alice@example.com',
      weekday: 1,
      target_time: '09:00:00',
      class_name: 'Yoga',
      facility_name: 'Studio A',
      days_in_advance: 3,
      one_time: false,
      execution_count: 2,
    },
    {
      id: 2,
      user_email: 'bob@example.com',
      weekday: 2,
      target_time: '10:00:00',
      class_name: 'Pilates',
      facility_name: 'Studio B',
      days_in_advance: 2,
      one_time: false,
      execution_count: 0,
    },
  ]
  vi.mocked(listAllJobs).mockResolvedValue(jobs)

  render(<AllJobsSection initialEmailFilter="alice@example.com" />)

  await waitFor(() => {
    expect(screen.getByDisplayValue('alice@example.com')).toBeInTheDocument()
    expect(screen.getByText('alice@example.com')).toBeInTheDocument()
    expect(screen.queryByText('bob@example.com')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/components/AllJobsSection.test.tsx
```

Expected: FAIL — `initialEmailFilter` prop not accepted.

- [ ] **Step 3: Add `initialEmailFilter` prop and sync effect**

In `frontend/src/components/AllJobsSection.tsx`, update the component signature and add a `useEffect`:

```tsx
export default function AllJobsSection({ initialEmailFilter }: { initialEmailFilter?: string }) {
  const [jobs, setJobs] = useState<AdminJob[]>([])
  const [loading, setLoading] = useState(true)
  const [emailFilter, setEmailFilter] = useState(initialEmailFilter ?? '')
  const [currentPage, setCurrentPage] = useState(1)

  // ... existing load/useEffect/handleFilterChange unchanged ...

  useEffect(() => {
    if (initialEmailFilter !== undefined) {
      setEmailFilter(initialEmailFilter)
      setCurrentPage(1)
    }
  }, [initialEmailFilter])
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/components/AllJobsSection.test.tsx
```

Expected: PASS (all tests green)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/AllJobsSection.tsx frontend/src/components/AllJobsSection.test.tsx
git commit -m "feat: AllJobsSection accepts initialEmailFilter prop"
```

---

### Task 2: `UserManagementSection` — klickbarer Jobs-Link

**Files:**
- Modify: `frontend/src/components/UserManagementSection.tsx`
- Modify: `frontend/src/components/UserManagementSection.test.tsx`

- [ ] **Step 1: Write the failing test**

In `frontend/src/components/UserManagementSection.test.tsx`, add:

```tsx
it('calls onJobsClick with user email when jobs count button is clicked', async () => {
  const users = [
    {
      id: 1,
      email: 'alice@example.com',
      role: 'user' as const,
      active: true,
      job_count: 3,
    },
  ]
  vi.mocked(listUsers).mockResolvedValue(users)
  // mock getEmail so alice is not "self"
  vi.mocked(getEmail).mockReturnValue('admin@example.com')

  const onJobsClick = vi.fn()
  render(<UserManagementSection onJobsClick={onJobsClick} />)

  const jobsButton = await screen.findByRole('button', { name: '3 Jobs' })
  fireEvent.click(jobsButton)

  expect(onJobsClick).toHaveBeenCalledWith('alice@example.com')
})

it('does not render a jobs button when job_count is 0', async () => {
  const users = [
    {
      id: 2,
      email: 'bob@example.com',
      role: 'user' as const,
      active: true,
      job_count: 0,
    },
  ]
  vi.mocked(listUsers).mockResolvedValue(users)
  vi.mocked(getEmail).mockReturnValue('admin@example.com')

  render(<UserManagementSection />)

  await waitFor(() => {
    expect(screen.queryByRole('button', { name: /Jobs/ })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && npx vitest run src/components/UserManagementSection.test.tsx
```

Expected: FAIL — `onJobsClick` prop not accepted, "x Jobs" not a button.

- [ ] **Step 3: Add `onJobsClick` prop and render button**

In `frontend/src/components/UserManagementSection.tsx`, update the component:

```tsx
export default function UserManagementSection({ onJobsClick }: { onJobsClick?: (email: string) => void } = {}) {
```

Ersetze die Jobs-Anzeige in der Userkarte (aktuell in Zeile 94):

```tsx
// vorher:
{user.job_count} {user.job_count === 1 ? 'Job' : 'Jobs'}

// nachher:
{onJobsClick && user.job_count > 0 ? (
  <button
    onClick={() => onJobsClick(user.email)}
    className="text-brand underline cursor-pointer hover:opacity-80 transition-opacity"
  >
    {user.job_count} {user.job_count === 1 ? 'Job' : 'Jobs'}
  </button>
) : (
  <>{user.job_count} {user.job_count === 1 ? 'Job' : 'Jobs'}</>
)}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && npx vitest run src/components/UserManagementSection.test.tsx
```

Expected: PASS (all tests green)

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/UserManagementSection.tsx frontend/src/components/UserManagementSection.test.tsx
git commit -m "feat: UserManagementSection shows clickable jobs link"
```

---

### Task 3: `DashboardPage` — State und Callback verbinden

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: State und Handler hinzufügen**

In `frontend/src/pages/DashboardPage.tsx`, direkt nach den bestehenden `useState`-Deklarationen (nach Zeile 30) einfügen:

```tsx
const [jobsEmailFilter, setJobsEmailFilter] = useState('')

function handleUserJobsClick(email: string) {
  setJobsEmailFilter(email)
  setActiveTab('jobs')
}
```

- [ ] **Step 2: Props an Kindkomponenten weitergeben**

`<UserManagementSection />` (aktuell in Zeile ~192) ersetzen durch:

```tsx
{isAdmin() && activeTab === 'benutzer' && (
  <UserManagementSection onJobsClick={handleUserJobsClick} />
)}
```

`<AllJobsSection />` (aktuell in Zeile ~195) ersetzen durch:

```tsx
{isAdmin() && activeTab === 'jobs' && (
  <AllJobsSection initialEmailFilter={jobsEmailFilter} />
)}
```

> Hinweis: Die bestehenden Wrapper-Conditions (z.B. `isAdmin() && activeTab === 'benutzer'`) bleiben erhalten — nur die Props werden ergänzt.

- [ ] **Step 3: TypeScript-Check ausführen**

```bash
cd frontend && npx tsc --noEmit
```

Expected: keine Fehler

- [ ] **Step 4: Alle Tests ausführen**

```bash
cd frontend && npx vitest run
```

Expected: alle Tests grün

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "feat: wire user jobs click through DashboardPage to AllJobsSection filter"
```
