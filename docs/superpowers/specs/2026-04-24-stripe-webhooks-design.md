# Stripe Webhooks — Design Spec

**Datum:** 2026-04-24

## Ziel

Stripe-Webhooks integrieren, um das `max_active_jobs`-Limit eines Benutzers automatisch zu steuern:
- Rechnung bezahlt → Limit aufheben (unbegrenzte Buchungen)
- Abo abgelaufen/gekündigt → alle Jobs deaktivieren, Limit auf 1 setzen

## Architektur

### Ansatz
Neuer FastAPI-Router `backend/api/webhooks.py` nach dem bestehenden Muster der anderen Router. Alle Stripe-Logik ist in dieser Datei gebündelt.

### Neue Dateien
- `backend/api/webhooks.py` — Router mit Checkout- und Webhook-Endpunkten
- `backend/templates/email/subscription_activated.html` — E-Mail bei Abo-Aktivierung
- `backend/templates/email/subscription_cancelled.html` — E-Mail bei Abo-Kündigung/Ablauf
- `backend/alembic/versions/<hash>_add_stripe_customer_id_to_users.py` — DB-Migration

### Geänderte Dateien
- `backend/models/user.py` — neues Feld `stripe_customer_id`
- `backend/main.py` — neuen Router registrieren
- `requirements-backend.txt` — `stripe` Package hinzufügen
- `backend/core/email.py` — zwei neue E-Mail-Hilfsfunktionen

## Datenmodell

```sql
-- Neues Feld in Tabelle users
stripe_customer_id  VARCHAR  NULL
```

`max_active_jobs`:
- `NULL` = unbegrenzte aktive Buchungen (bezahltes Abo)
- `1` = maximal 1 aktive Buchung (kein aktives Abo)

## Umgebungsvariablen

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `STRIPE_SECRET_KEY` | ✓ | Stripe API Secret Key |
| `STRIPE_WEBHOOK_SECRET` | ✓ | Signing Secret aus Stripe Dashboard |
| `STRIPE_PRICE_ID` | ✓ | Preis-ID des Abonnements |

## API-Endpunkte

### `POST /api/stripe/checkout`
- **Auth:** JWT (eingeloggter User)
- **Aktion:** Erstellt Stripe Checkout Session mit `client_reference_id = user.id` und `STRIPE_PRICE_ID`
- **Response:** `{ "url": "https://checkout.stripe.com/..." }`

### `POST /api/stripe/webhook`
- **Auth:** Stripe-Signatur-Verifikation via `Stripe-Signature` Header
- **Body:** Roher Request-Body (Bytes, kein Pydantic-Schema)
- **Verifikation:** `stripe.Webhook.construct_event(raw_body, sig_header, STRIPE_WEBHOOK_SECRET)`
- Bei ungültiger Signatur → `400`

## Verarbeitete Stripe-Events

### `checkout.session.completed`
**Zweck:** Einmalige Verknüpfung User ↔ Stripe Customer beim ersten Kauf

**Vorgehen:**
1. `client_reference_id` aus Event lesen (= `user.id`)
2. User in DB per ID suchen
3. `stripe_customer_id` aus Event in User speichern

**Hinweis:** Kein Limit-Update hier — `invoice.paid` folgt direkt danach und übernimmt das.

---

### `invoice.paid`
**Zweck:** Abo aktiv → Limit aufheben

**Vorgehen:**
1. `stripe_customer_id` aus Event lesen
2. User per `stripe_customer_id` in DB suchen
3. `user.max_active_jobs = None` setzen
4. E-Mail "Abo aktiviert" senden

**E-Mail-Variablen:** `frontend_url`, `plan_name`, `amount` (in €), `subscription_end` (nächstes Abrechnungsdatum)

---

### `customer.subscription.deleted`
**Zweck:** Abo abgelaufen/gekündigt → Jobs deaktivieren, Limit setzen

**Vorgehen:**
1. `stripe_customer_id` aus Event lesen
2. User per `stripe_customer_id` in DB suchen
3. Alle Jobs des Users mit `enabled = True` auf `enabled = False` setzen
4. `user.max_active_jobs = 1` setzen
5. E-Mail "Abo abgelaufen" senden

**Verhalten danach:** User kann Jobs manuell reaktivieren. Beim Toggle greift die bestehende `_check_job_limit()`-Logik in `jobs.py` — bei `max_active_jobs = 1` kann maximal 1 Job aktiv sein.

**E-Mail-Variablen:** `frontend_url`, `cancelled_at` (Datum des Ablaufs), `deactivated_jobs_count`

## Fehlerbehandlung

| Situation | Verhalten |
|---|---|
| Stripe-Signatur ungültig | `400` zurückgeben |
| User nicht gefunden (customer_id unbekannt) | `200` zurückgeben, Fehler loggen |
| Unbekannter Event-Typ | `200` zurückgeben, ignorieren |
| E-Mail-Versand schlägt fehl | Loggen, kein Fehler (DB-Änderung ist primär) |

Stripe erwartet `200` bei allen verarbeiteten Events — sonst wiederholt es die Zustellung.

## E-Mail-Templates

### `subscription_activated.html`
- Betreff: "Dein Abo ist aktiv"
- Info: unbegrenzte Buchungen möglich, nächstes Abrechnungsdatum, Betrag, Plan-Name

### `subscription_cancelled.html`
- Betreff: "Dein Abo ist abgelaufen"
- Info: Abo abgelaufen am `cancelled_at`, `deactivated_jobs_count` Jobs deaktiviert, nur noch 1 Buchung möglich, Link zum Frontend

## Autorisierung & Sicherheit

- Webhook-Endpoint ist **ohne JWT** erreichbar (Stripe's Server haben keinen Token)
- Schutz ausschließlich via HMAC-SHA256-Signaturverifikation (`Stripe-Signature` Header)
- `STRIPE_WEBHOOK_SECRET` darf nie in die Versionskontrolle
