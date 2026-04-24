# Stripe Checkout Button (Admin) — Design Spec

**Datum:** 2026-04-24

## Ziel

Einen "Abo kaufen"-Button im SettingsModal einbauen, der nur für Admins sichtbar ist. Der Button ist ausgegraut wenn bereits ein aktives Abo besteht, und leitet bei Klick zu Stripe Checkout weiter.

## Architektur

Neuer `GET /api/me` Backend-Endpunkt liefert den Abo-Status des eingeloggten Users. Das Frontend fragt diesen Endpunkt beim Öffnen des SettingsModals ab und rendert den Button entsprechend. Stripe-spezifische API-Calls landen in einer neuen `frontend/src/api/stripe.ts` Datei.

## Dateien

| Datei | Aktion | Inhalt |
|---|---|---|
| `backend/schemas/user.py` | Erweitern | Neues `MeResponse` Schema |
| `backend/api/account.py` | Erweitern | `GET /api/me` Endpunkt |
| `frontend/src/api/stripe.ts` | Neu | `getMe()` + `createCheckoutSession()` |
| `frontend/src/components/SettingsModal.tsx` | Erweitern | Abo-Sektion mit Button |

## Backend

### Neues Schema `MeResponse` in `backend/schemas/user.py`

```python
class MeResponse(BaseModel):
    email: str
    role: str
    subscription_active: bool
```

`subscription_active` wird abgeleitet aus `current_user.max_active_jobs is None`:
- `None` = Abo aktiv (unbegrenzte Jobs)
- `1` oder ein anderer Wert = kein aktives Abo

### Neuer Endpunkt `GET /api/me` in `backend/api/account.py`

```python
@router.get("/me", response_model=MeResponse)
def get_me(current_user: User = Depends(get_current_active_user)):
    return MeResponse(
        email=current_user.email,
        role=current_user.role,
        subscription_active=current_user.max_active_jobs is None,
    )
```

## Frontend

### Neue Datei `frontend/src/api/stripe.ts`

```typescript
import { apiFetch } from './client'

export interface MeResponse {
  email: string
  role: string
  subscription_active: boolean
}

export const getMe = (): Promise<MeResponse> =>
  apiFetch('/api/me')

export const createCheckoutSession = (): Promise<{ url: string }> =>
  apiFetch('/api/stripe/checkout', { method: 'POST' })
```

### Änderungen in `SettingsModal.tsx`

**State:**
- `subscriptionActive: boolean | null` — `null` während Laden, `true/false` nach Fetch
- `checkoutLoading: boolean` — während Checkout-URL abgerufen wird
- `checkoutError: string | null`

**Beim Mounten** (nur wenn `isActualAdmin()`): `getMe()` aufrufen, `subscriptionActive` setzen.

**Neuer Abschnitt** oberhalb von "Konto löschen", nur sichtbar wenn `isActualAdmin()`:

```
Abonnement
[Abo kaufen]   ← ausgegraut + "Abo bereits aktiv" wenn subscription_active === true
               ← "Wird vorbereitet…" während Checkout-URL geladen wird
               ← Fehlermeldung wenn API-Call fehlschlägt
```

**Klick-Handler:**
1. `checkoutLoading = true`
2. `createCheckoutSession()` aufrufen
3. `window.location.href = data.url`
4. Bei Fehler: `checkoutError` setzen, `checkoutLoading = false`

## Fehlerbehandlung

| Situation | Verhalten |
|---|---|
| `getMe()` schlägt fehl | Button trotzdem anzeigen, `subscriptionActive = false` annehmen |
| `createCheckoutSession()` schlägt fehl | Fehlermeldung unter Button, Button wieder klickbar |
| Während Checkout-URL geladen wird | Button deaktiviert mit Text "Wird vorbereitet…" |

## Tests

- `GET /api/me` mit aktivem Abo → `subscription_active: true`
- `GET /api/me` ohne Abo → `subscription_active: false`
- `GET /api/me` ohne Auth → `401`
