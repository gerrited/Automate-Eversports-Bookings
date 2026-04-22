# Design: Benutzerverwaltung — E-Mail-Filter & Paginierung

**Datum:** 2026-04-17

## Kontext

Die Benutzerverwaltung im Admin-Dashboard zeigt aktuell alle registrierten User in einer unlimitierten Liste. Bei wachsender Benutzerzahl wird die Liste unübersichtlich. Gewünscht sind:

1. Ein Live-Filter nach E-Mail-Adresse
2. Seitenweise Anzeige mit maximal 25 Usern pro Seite
3. Vor/Zurück-Navigation

## Entscheidungen

- **Client-seitige Implementierung**: Alle User werden weiterhin einmalig geladen. Filter und Paginierung passieren vollständig im Frontend per JavaScript. Kein Backend-Aufwand nötig — für ein Admin-Tool mit realistisch < 1.000 Usern ist das ausreichend.
- **Live-Filter ab 3 Zeichen**: Kürzere Eingaben werden ignoriert (alle User sichtbar), um versehentliche Einschränkungen bei 1–2 Zeichen zu vermeiden.
- **Layout Variante A**: Suchfeld oben, Info-Zeile mit Anzahl + Seitenposition, Vor/Zurück-Buttons unten.

## Betroffene Dateien

- `frontend/src/components/UserManagementSection.tsx` — einzige Änderung

## Komponenten-Design

### State

```typescript
const [emailFilter, setEmailFilter] = useState('')
const [currentPage, setCurrentPage] = useState(1)
```

### Abgeleitete Werte (keine zusätzlichen States)

```typescript
const PAGE_SIZE = 25

const filteredUsers = emailFilter.length >= 3
  ? users.filter(u => u.email.toLowerCase().includes(emailFilter.toLowerCase()))
  : users

const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))

const pagedUsers = filteredUsers.slice(
  (currentPage - 1) * PAGE_SIZE,
  currentPage * PAGE_SIZE
)
```

### Filter-Handler

```typescript
function handleFilterChange(value: string) {
  setEmailFilter(value)
  setCurrentPage(1) // Immer auf Seite 1 zurückspringen
}
```

### UI-Elemente

1. **Suchfeld** — `placeholder="Nach E-Mail filtern…"` (kein Emoji), gesteuert via `emailFilter`-State
2. **Info-Zeile** — `"{filteredUsers.length} von {users.length} Benutzern · Seite {currentPage} von {totalPages}"`
3. **User-Liste** — iteriert über `pagedUsers` (identische Darstellung wie bisher)
4. **Paginierungs-Leiste** — Vor/Zurück-Buttons, disabled-Zustand an den Seitengrenzen:
   - Zurück: disabled wenn `currentPage === 1`
   - Weiter: disabled wenn `currentPage === totalPages`

## Verhalten

| Situation | Verhalten |
|-----------|-----------|
| Filter < 3 Zeichen | Alle User sichtbar, Paginierung normal |
| Filter ≥ 3 Zeichen | Nur passende User, Seite springt auf 1 |
| Filter ergibt 0 Treffer | Liste leer, Info-Zeile zeigt "0 von X Benutzern" |
| Nur 1 Seite | Beide Buttons disabled |
| User aktivieren/deaktivieren | Reload der Liste, aktueller Filter + Seite bleiben erhalten |

## Verifikation

- Ohne Filter: alle User geladen, Paginierung funktioniert (25 pro Seite)
- Filter mit 2 Zeichen: keine Einschränkung, alle User sichtbar
- Filter mit 3+ Zeichen: nur passende User, Seite auf 1 zurückgesetzt
- Letzte Seite: "Weiter"-Button disabled
- Erste Seite: "Zurück"-Button disabled
- Aktivieren/Deaktivieren eines Users: Filter und aktuelle Seite bleiben
