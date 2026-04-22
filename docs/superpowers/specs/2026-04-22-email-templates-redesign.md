# Email Templates Redesign

**Date:** 2026-04-22  
**Status:** Approved

## Overview

Redesign all 5 Jinja2 email templates to match the FOReversports landing page aesthetic: dark theme, card layout, logo, and brand colors.

## Design Decisions

- **Theme:** Dark (matching the app — `#021214` outer, `#03191b` card/logo-strip)
- **Layout:** Card-A — zentrierte Karte auf dunklem Hintergrund
- **Logo:** Hybrid — `<img src="{{ frontend_url }}/logo.png" alt="FOReversports">` mit CSS-Text-Fallback (`∞ FOReversports`) wenn Bild nicht lädt
- **Logo-Bereich:** Eigener Header-Streifen (`#03191b`) damit das PNG mit transparentem Hintergrund korrekt dargestellt wird

## Brand Colors

| Token | Hex | Verwendung |
|---|---|---|
| `surface-page` | `#021214` | E-Mail-Außenbereich |
| `surface-card` | `#03191b` | Karten-Hintergrund, Logo-Streifen |
| `surface-input` | `#052528` | Info-Blöcke / Detail-Listen |
| `brand` | `#004349` | CTA-Button-Hintergrund |
| `brand-teal` | `#26b5c0` | Logo-Fallback-Text (∞ FOR) |
| Text primär | `#f1f5f9` | Überschriften |
| Text sekundär | `#94a3b8` | Fließtext |
| Text stark | `#e2e8f0` | Hervorgehobene Werte in Text |
| Border | `rgba(100,116,139,0.3)` | Karten-Rahmen |
| Fehler | `#f87171` | Fehlertext, `#1a0a0a` Fehler-Block-BG |
| Erfolg | `#86efac` | Erfolgstext, `#031a0d` Erfolg-Block-BG |
| Info | `#94a3b8` | Info-Block-Text, `#004349`-Border |

## Shared Template Structure

Alle Templates teilen dieselbe HTML-Rahmenstruktur:

```
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[Betreff]</title>
    <style>/* Inline styles — keine externen Stylesheets */</style>
  </head>
  <body style="background:#021214; margin:0; padding:32px 16px;">
    <div style="max-width:600px; margin:0 auto; ...">

      <!-- Logo-Streifen -->
      <div style="background:#03191b; border-radius:12px 12px 0 0; padding:18px 24px; border:1px solid rgba(100,116,139,0.2); border-bottom:none;">
        <img src="{{ frontend_url }}/logo.png" alt="FOReversports" height="36"
             onerror="this.style.display='none';this.nextSibling.style.display='inline'">
        <span style="display:none; ...">∞ FOReversports</span>  <!-- CSS-Fallback -->
      </div>

      <!-- Inhaltskarte -->
      <div style="background:#03191b; border-radius:0 0 12px 12px; border:1px solid rgba(100,116,139,0.2); border-top:1px solid rgba(100,116,139,0.15); padding:24px;">
        <!-- Template-spezifischer Inhalt -->
      </div>

      <!-- Footer -->
      <p style="color:#374151; font-size:11px; text-align:center; margin:16px 0 0;">
        FOReversports · [Kategorie]
      </p>

    </div>
  </body>
</html>
```

## Templates

### 1. `booking_failure.html` (backend + worker)

**Betreff-Kontext:** Fehler beim automatischen Buchen  
**Blöcke:**
- Überschrift: „Buchung fehlgeschlagen"
- Einleitungstext
- Detail-Liste (Kurs, Tag, Ort) — `#021214`-BG, `border-radius:6px`
- Fehler-Block — `#1a0a0a`-BG, linker roter Border (`#f87171`), Monospace-Font
- Hinweistext: „Der Job ist weiterhin aktiv..."
- CTA-Button: „Zur App →" → `{{ frontend_url }}`
- Footer: „Automatische Buchungsbenachrichtigung"

**Variablen:** `class_name`, `time_str`, `weekday_str`, `date_str`, `facility_name`, `error_message`, `frontend_url`

---

### 2. `debug_cancel_failure.html` (backend + worker)

Wie `booking_failure.html`, aber:
- Überschrift: „Debug-Stornierung fehlgeschlagen"
- Einleitung erklärt: Buchung erfolgreich, Stornierung fehlgeschlagen
- Hinweis: „Bitte storniere manuell auf Eversports."

**Variablen:** identisch mit `booking_failure`

---

### 3. `account_activated.html` (backend)

**Betreff-Kontext:** Konto freigeschaltet  
**Blöcke:**
- Überschrift: „Konto freigeschaltet"
- Erfolgs-Block (grüner linker Border): „Dein Konto ist jetzt aktiv."
- Fließtext
- CTA-Button: „Jetzt anmelden →" → `{{ frontend_url }}`
- Footer: „Kontobenachrichtigung"

**Variablen:** `frontend_url`

---

### 4. `account_deactivated.html` (backend)

**Betreff-Kontext:** Konto deaktiviert  
**Blöcke:**
- Überschrift: „Konto deaktiviert"
- Fließtext mit Hinweis, Admin zu kontaktieren
- Kein CTA-Button (kein login möglich)
- Footer: „Kontobenachrichtigung"

**Variablen:** keine

---

### 5. `new_user_notification.html` (backend)

**Betreff-Kontext:** Admin-Benachrichtigung  
**Blöcke:**
- Überschrift: „Neuer Benutzer wartet auf Freigabe"
- Info-Block (teal linker Border): E-Mail + Registrierungsdatum
- Fließtext
- CTA-Button: „Zur Benutzerverwaltung →" → `{{ users_url }}`
- Footer: „Admin-Benachrichtigung"

**Variablen:** `new_user_email`, `now`, `users_url`

## Files to Create/Modify

Die 4 Backend-Templates ersetzen bestehende Dateien:
- `backend/templates/email/booking_failure.html`
- `backend/templates/email/debug_cancel_failure.html`
- `backend/templates/email/account_activated.html`
- `backend/templates/email/account_deactivated.html`
- `backend/templates/email/new_user_notification.html`

Die 2 Worker-Templates sind Kopien der Booking-Failure-Templates:
- `worker/templates/email/booking_failure.html`
- `worker/templates/email/debug_cancel_failure.html`

## Out of Scope

- Änderungen an `backend/core/email.py` oder `worker/email.py` (keine neuen E-Mail-Typen)
- Neue Umgebungsvariablen
- Unsubscribe-Links oder rechtliche Footer-Texte
