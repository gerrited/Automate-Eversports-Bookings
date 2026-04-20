# Admin-Rolle-Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins können im Hamburger-Menü per Checkbox zwischen Admin-Ansicht und User-Ansicht wechseln; eine neue localStorage-Variable `isActualAdmin` steuert die Sichtbarkeit der Checkbox.

**Architecture:** `isActualAdmin` wird beim Login in localStorage geschrieben (unveränderlich bis Logout) und zeigt an, ob der User tatsächlich Admin ist. `role` in localStorage bleibt die aktiv angezeigte Rolle und wird per Checkbox getoggelt. Ein `auth-changed`-Event triggert einen Re-Render des Dashboards.

**Tech Stack:** React 19, TypeScript, Tailwind CSS, localStorage

---

## Geänderte Dateien

- Modify: `frontend/src/api/client.ts` — neue Funktionen `setIsActualAdmin`, `isActualAdmin`; `clearToken` erweitert
- Modify: `frontend/src/api/auth.ts` — `setIsActualAdmin` nach Login aufrufen
- Modify: `frontend/src/components/HamburgerMenu.tsx` — neue Props + Checkbox-UI
- Modify: `frontend/src/pages/DashboardPage.tsx` — `auth-changed` Listener + neue Props übergeben

---

### Task 1: `client.ts` — `isActualAdmin`-Funktionen + `clearToken` erweitern

**Files:**
- Modify: `frontend/src/api/client.ts`

- [ ] **Step 1: Funktionen hinzufügen und `clearToken` erweitern**

Die Datei öffnen. Den Block ab Zeile 23 (`clearToken`) so anpassen und zwei neue Funktionen vor `clearToken` einfügen:

```typescript
export function setIsActualAdmin(value: boolean): void {
  if (value) {
    localStorage.setItem('isActualAdmin', 'true')
  } else {
    localStorage.removeItem('isActualAdmin')
  }
}

export function isActualAdmin(): boolean {
  return localStorage.getItem('isActualAdmin') === 'true'
}

export function clearToken(): void {
  localStorage.removeItem('token')
  localStorage.removeItem('email')
  localStorage.removeItem('role')
  localStorage.removeItem('avatarUrl')
  localStorage.removeItem('isActualAdmin')
  window.dispatchEvent(new Event('auth-changed'))
}
```

- [ ] **Step 2: TypeScript-Fehler prüfen**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Erwartete Ausgabe: keine Fehler

- [ ] **Step 3: Committen**

```bash
git add frontend/src/api/client.ts
git commit -m "feat: add isActualAdmin localStorage helpers"
```

---

### Task 2: `auth.ts` — `isActualAdmin` beim Login setzen

**Files:**
- Modify: `frontend/src/api/auth.ts`

- [ ] **Step 1: Import ergänzen und `setIsActualAdmin` aufrufen**

Aktuelle Datei:
```typescript
import { apiFetch, setToken, setEmail, setRole, setAvatarUrl } from './client'

export async function login(email: string, password: string): Promise<void> {
  const data = await apiFetch<{ access_token: string; role: string; avatar_url?: string | null }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setToken(data.access_token)
  setRole(data.role)
  setEmail(email)
  if (data.avatar_url) setAvatarUrl(data.avatar_url)
}
```

Ersetzen durch:
```typescript
import { apiFetch, setToken, setEmail, setRole, setAvatarUrl, setIsActualAdmin } from './client'

export async function login(email: string, password: string): Promise<void> {
  const data = await apiFetch<{ access_token: string; role: string; avatar_url?: string | null }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  setToken(data.access_token)
  setRole(data.role)
  setIsActualAdmin(data.role === 'admin')
  setEmail(email)
  if (data.avatar_url) setAvatarUrl(data.avatar_url)
}
```

- [ ] **Step 2: TypeScript-Fehler prüfen**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Erwartete Ausgabe: keine Fehler

- [ ] **Step 3: Committen**

```bash
git add frontend/src/api/auth.ts
git commit -m "feat: persist isActualAdmin on login"
```

---

### Task 3: `HamburgerMenu.tsx` — Checkbox-UI

**Files:**
- Modify: `frontend/src/components/HamburgerMenu.tsx`

- [ ] **Step 1: Props-Interface und Import erweitern**

Am Anfang der Datei den Import und das Interface anpassen:

```typescript
import { useState, useEffect, useRef } from 'react'
import { setRole } from '../api/client'

interface Props {
  onLogout: () => void
  onSettings: () => void
  userEmail?: string | null
  userAvatar?: string | null
  isActualAdmin?: boolean
  isAdminView?: boolean
}
```

- [ ] **Step 2: Komponente Props ergänzen und Checkbox einbauen**

Die Funktionssignatur und den Dropdown-Block ersetzen:

```typescript
export default function HamburgerMenu({ onLogout, onSettings, userEmail, userAvatar, isActualAdmin, isAdminView }: Props) {
```

Den Dropdown-Block (ab `{open && (`) so abändern, dass die Checkbox zwischen "Einstellungen" und "Abmelden" erscheint:

```tsx
{open && (
  <div className="absolute right-0 mt-2 w-44 rounded-lg bg-surface-card border border-slate-700 shadow-lg z-50 overflow-hidden">
    <button
      onClick={() => { setOpen(false); onSettings() }}
      className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
    >
      Einstellungen
    </button>
    {isActualAdmin && (
      <>
        <div className="border-t border-slate-700" />
        <label className="flex items-center gap-2 px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 transition-colors cursor-pointer">
          <input
            type="checkbox"
            checked={isAdminView ?? false}
            onChange={e => {
              setRole(e.target.checked ? 'admin' : 'user')
              window.dispatchEvent(new Event('auth-changed'))
            }}
            className="accent-brand"
          />
          Admin
        </label>
      </>
    )}
    <div className="border-t border-slate-700" />
    <button
      onClick={() => { setOpen(false); onLogout() }}
      className="w-full text-left px-4 py-3 text-sm text-slate-200 hover:bg-slate-700 transition-colors"
    >
      Abmelden
    </button>
  </div>
)}
```

- [ ] **Step 3: TypeScript-Fehler prüfen**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Erwartete Ausgabe: keine Fehler

- [ ] **Step 4: Committen**

```bash
git add frontend/src/components/HamburgerMenu.tsx
git commit -m "feat: add admin role toggle checkbox to HamburgerMenu"
```

---

### Task 4: `DashboardPage.tsx` — Listener + neue Props übergeben

**Files:**
- Modify: `frontend/src/pages/DashboardPage.tsx`

- [ ] **Step 1: Import `isActualAdmin` ergänzen**

Zeile 3 anpassen:

```typescript
import { clearToken, isAdmin, isActualAdmin, getEmail, getAvatarUrl } from '../api/client'
```

- [ ] **Step 2: `auth-changed` Listener für Re-Render hinzufügen**

Nach den bestehenden `useState`-Deklarationen (ca. Zeile 39, nach `debugFilter`) einen neuen State und einen `useEffect` einfügen:

```typescript
const [, forceUpdate] = useState(0)

useEffect(() => {
  function onAuthChanged() { forceUpdate(n => n + 1) }
  window.addEventListener('auth-changed', onAuthChanged)
  return () => window.removeEventListener('auth-changed', onAuthChanged)
}, [])
```

- [ ] **Step 3: Props an `HamburgerMenu` übergeben**

Zeile 144 (der `<HamburgerMenu>`-Aufruf) anpassen:

```tsx
<HamburgerMenu
  onLogout={handleLogout}
  onSettings={() => setShowSettings(true)}
  userEmail={getEmail()}
  userAvatar={getAvatarUrl()}
  isActualAdmin={isActualAdmin()}
  isAdminView={isAdmin()}
/>
```

- [ ] **Step 4: TypeScript-Fehler prüfen**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Erwartete Ausgabe: keine Fehler

- [ ] **Step 5: Committen**

```bash
git add frontend/src/pages/DashboardPage.tsx
git commit -m "feat: wire auth-changed listener and isActualAdmin prop in DashboardPage"
```

---

### Task 5: Manuell testen

- [ ] **Step 1: Dev-Server starten**

```bash
cd frontend && npm run dev
```

- [ ] **Step 2: Als Admin einloggen**

Im Browser zu `http://localhost:5173` navigieren und mit einem Admin-Account einloggen.

Prüfen:
- localStorage enthält `isActualAdmin = "true"` und `role = "admin"` (DevTools → Application → Local Storage)
- Im Hamburger-Menü ist die Checkbox "Admin" sichtbar und angehakt
- Admin-Tabs (Buchungen / Benutzer / Jobs) sind sichtbar

- [ ] **Step 3: Checkbox deaktivieren (→ User-Ansicht)**

Hamburger-Menü öffnen, Checkbox "Admin" abwählen.

Prüfen:
- `role` in localStorage ist jetzt `"user"`
- `isActualAdmin` in localStorage ist weiterhin `"true"`
- Admin-Tabs verschwinden sofort
- Checkbox "Admin" ist weiterhin sichtbar (da `isActualAdmin` noch gesetzt)

- [ ] **Step 4: Checkbox wieder aktivieren (→ Admin-Ansicht)**

Checkbox "Admin" anhaken.

Prüfen:
- `role` in localStorage ist wieder `"admin"`
- Admin-Tabs erscheinen sofort

- [ ] **Step 5: Page-Reload testen**

In der User-Ansicht (Checkbox deaktiviert) die Seite neu laden.

Prüfen:
- User-Ansicht bleibt erhalten (keine Admin-Tabs)
- Checkbox "Admin" ist weiterhin sichtbar und abgehakt

- [ ] **Step 6: Logout testen**

Abmelden.

Prüfen:
- localStorage enthält weder `isActualAdmin` noch `role`

- [ ] **Step 7: Als normaler User einloggen**

Mit einem User-Account (nicht Admin) einloggen.

Prüfen:
- `isActualAdmin` ist nicht in localStorage vorhanden
- Im Hamburger-Menü ist keine Checkbox sichtbar
