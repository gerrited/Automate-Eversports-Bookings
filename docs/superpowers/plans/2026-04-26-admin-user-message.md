# Admin-Nachricht an User — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Admins können über die User-Verwaltung eine E-Mail-Nachricht (Betreff + Freitext) an einen einzelnen User senden.

**Architecture:** Neuer `POST /admin/users/{user_id}/message`-Endpoint in `backend/api/admin.py`, neue `send_admin_message()`-Funktion in `backend/core/email.py`, neues Jinja2-Template, "Nachricht"-Button auf jeder User-Karte in `UserManagementSection.tsx` öffnet ein Modal.

**Tech Stack:** FastAPI, Resend (via `resend`-Paket), Jinja2, React, TypeScript, Tailwind CSS

---

## Dateien-Übersicht

| Aktion  | Datei                                                        | Inhalt                                         |
|---------|--------------------------------------------------------------|------------------------------------------------|
| Erstellen | `backend/templates/email/admin_message.html`               | Jinja2-HTML-E-Mail-Template                    |
| Ändern  | `backend/core/email.py`                                      | `send_admin_message()` hinzufügen              |
| Ändern  | `backend/api/admin.py`                                       | Neuer Endpoint + Import                        |
| Ändern  | `tests/backend/test_email_templates.py`                      | Template-Render-Test                           |
| Ändern  | `tests/backend/test_api_admin.py`                            | API-Tests für neuen Endpoint                   |
| Ändern  | `frontend/src/api/users.ts`                                  | `sendUserMessage()` hinzufügen                 |
| Ändern  | `frontend/src/components/UserManagementSection.tsx`          | Button + Modal                                 |

---

## Task 1: E-Mail-Template

**Files:**
- Create: `backend/templates/email/admin_message.html`
- Modify: `tests/backend/test_email_templates.py`

- [ ] **Schritt 1: Failing-Test schreiben**

Ans Ende von `tests/backend/test_email_templates.py` anfügen:

```python
def test_admin_message_renders():
    html = _env(BACKEND_DIR).get_template("admin_message.html").render(
        subject="Wichtige Information",
        content="Hallo,\ndies ist eine Nachricht vom Admin.",
        frontend_url=FRONTEND_URL,
    )
    assert "Wichtige Information" in html
    assert "Hallo," in html
    assert "dies ist eine Nachricht vom Admin." in html
    assert FRONTEND_URL in html
    assert "#004349" in html
```

- [ ] **Schritt 2: Test ausführen — erwarteter Fehler**

```bash
pytest tests/backend/test_email_templates.py::test_admin_message_renders -v
```

Erwartet: `FAILED` — `TemplateNotFound: admin_message.html`

- [ ] **Schritt 3: Template erstellen**

Datei `backend/templates/email/admin_message.html` mit folgendem Inhalt anlegen:

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ subject }}</title>
</head>
<body style="background:#021214;margin:0;padding:32px 16px;font-family:-apple-system,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;">

    <div style="background:#03191b;border-radius:12px 12px 0 0;padding:18px 24px;border:1px solid rgba(100,116,139,0.2);border-bottom:1px solid rgba(100,116,139,0.15);">
      <img src="{{ frontend_url }}/logo.png" alt="FOReversports" height="36"
           style="display:inline-block;vertical-align:middle;"
           onerror="this.style.display='none';this.nextElementSibling.style.display='inline-block'">
      <span style="display:none;font-size:18px;font-weight:700;vertical-align:middle;letter-spacing:-0.3px;">
        <span style="color:#26b5c0;">∞ FOR</span><span style="color:#9ca3af;font-weight:400;">eversports</span>
      </span>
    </div>

    <div style="background:#03191b;border-radius:0 0 12px 12px;border:1px solid rgba(100,116,139,0.2);border-top:none;padding:24px;">
      <p style="color:#f1f5f9;font-size:18px;font-weight:600;margin:0 0 16px;">{{ subject }}</p>
      <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0;white-space:pre-wrap;">{{ content }}</p>
    </div>

    <p style="color:#374151;font-size:11px;text-align:center;margin:16px 0 0;">FOReversports · Nachricht vom Administrator</p>
  </div>
</body>
</html>
```

- [ ] **Schritt 4: Test erneut ausführen — grün**

```bash
pytest tests/backend/test_email_templates.py::test_admin_message_renders -v
```

Erwartet: `PASSED`

- [ ] **Schritt 5: Commit**

```bash
git add backend/templates/email/admin_message.html tests/backend/test_email_templates.py
git commit -m "feat: add admin_message email template"
```

---

## Task 2: Backend-E-Mail-Funktion

**Files:**
- Modify: `backend/core/email.py`

- [ ] **Schritt 1: Funktion `send_admin_message` ans Ende von `backend/core/email.py` anfügen**

```python
def send_admin_message(user_email: str, subject: str, content: str) -> None:
    """Sendet eine Admin-Nachricht an einen User. Best-effort — kein Crash bei Fehlern."""
    try:
        resend.api_key = os.environ["RESEND_API_KEY"]
        from_email = os.environ["FROM_EMAIL"]
        sender = f"FOReversports <{from_email}>"
        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:5173")

        html = _templates.get_template("admin_message.html").render(
            subject=subject,
            content=content,
            frontend_url=frontend_url,
        )
        resend.Emails.send({
            "from": sender,
            "to": [user_email],
            "subject": subject,
            "html": html,
        })
        log.info("Admin message sent to %s (subject=%r)", user_email, subject)
    except Exception as exc:
        log.error("Failed to send admin message to %s: %s", user_email, exc)
```

- [ ] **Schritt 2: Bestehende Tests sicherstellen**

```bash
pytest tests/backend/test_email_templates.py -v
```

Erwartet: alle `PASSED`

- [ ] **Schritt 3: Commit**

```bash
git add backend/core/email.py
git commit -m "feat: add send_admin_message email function"
```

---

## Task 3: API-Endpoint

**Files:**
- Modify: `backend/api/admin.py`
- Modify: `tests/backend/test_api_admin.py`

- [ ] **Schritt 1: Failing-Tests schreiben**

Ans Ende von `tests/backend/test_api_admin.py` anfügen:

```python
# --- /admin/users/{id}/message ---

def test_send_message_requires_admin(client, db_session):
    user = _make_user(db_session, ev_id="ev-msg0", email="msg0@x.com")
    resp = client.post(
        f"/api/admin/users/{user.id}/message",
        json={"subject": "Test", "content": "Hallo"},
        headers=_auth_header(user.id),
    )
    assert resp.status_code == 403


def test_send_message_user_not_found(client, db_session):
    admin = _make_admin(db_session, ev_id="ev-msg1", email="msg1@x.com")
    resp = client.post(
        "/api/admin/users/nonexistent-id/message",
        json={"subject": "Test", "content": "Hallo"},
        headers=_auth_header(admin.id),
    )
    assert resp.status_code == 404


def test_send_message_calls_send_admin_message(client, db_session, mocker):
    admin = _make_admin(db_session, ev_id="ev-msg2", email="msg2@x.com")
    user = _make_user(db_session, ev_id="ev-msg2u", email="msg2u@x.com")
    mock_email = mocker.patch("backend.api.admin.send_admin_message")

    resp = client.post(
        f"/api/admin/users/{user.id}/message",
        json={"subject": "Wichtige Info", "content": "Hallo,\nDies ist eine Nachricht."},
        headers=_auth_header(admin.id),
    )

    assert resp.status_code == 200
    assert resp.json()["detail"] == "Nachricht gesendet"
    mock_email.assert_called_once_with(
        "msg2u@x.com",
        "Wichtige Info",
        "Hallo,\nDies ist eine Nachricht.",
    )


def test_send_message_email_failure_does_not_affect_response(client, db_session, mocker):
    admin = _make_admin(db_session, ev_id="ev-msg3", email="msg3@x.com")
    user = _make_user(db_session, ev_id="ev-msg3u", email="msg3u@x.com")
    mocker.patch(
        "backend.api.admin.send_admin_message",
        side_effect=Exception("Resend down"),
    )

    resp = client.post(
        f"/api/admin/users/{user.id}/message",
        json={"subject": "Test", "content": "Inhalt"},
        headers=_auth_header(admin.id),
    )

    assert resp.status_code == 200


def test_send_message_requires_auth(client):
    resp = client.post(
        "/api/admin/users/some-id/message",
        json={"subject": "Test", "content": "Hallo"},
    )
    assert resp.status_code == 401
```

- [ ] **Schritt 2: Tests ausführen — erwarteter Fehler**

```bash
pytest tests/backend/test_api_admin.py::test_send_message_requires_admin tests/backend/test_api_admin.py::test_send_message_user_not_found tests/backend/test_api_admin.py::test_send_message_calls_send_admin_message -v
```

Erwartet: `FAILED` — `404 Not Found` (Endpoint existiert noch nicht)

- [ ] **Schritt 3: Import und Endpoint in `backend/api/admin.py` hinzufügen**

Zeile 11 — Import erweitern (vorher):
```python
from backend.core.email import send_account_status_email, send_limit_enforced_email, send_test_email
```

Zeile 11 — Import erweitern (nachher):
```python
from backend.core.email import send_account_status_email, send_admin_message, send_limit_enforced_email, send_test_email
```

Direkt vor der `TestEmailRequest`-Klasse (Zeile 225) einfügen:

```python
class SendMessageRequest(BaseModel):
    subject: str
    content: str


@router.post("/admin/users/{user_id}/message")
def send_message_to_user(
    user_id: str,
    body: SendMessageRequest,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    try:
        send_admin_message(user.email, body.subject, body.content)
    except Exception as exc:
        log.error("Failed to send admin message: %s", exc)
    return {"detail": "Nachricht gesendet"}
```

- [ ] **Schritt 4: Alle neuen Tests ausführen — grün**

```bash
pytest tests/backend/test_api_admin.py -k "message" -v
```

Erwartet: alle 5 Tests `PASSED`

- [ ] **Schritt 5: Gesamte Admin-Testsuite sicherstellen**

```bash
pytest tests/backend/test_api_admin.py -v
```

Erwartet: alle `PASSED`

- [ ] **Schritt 6: Commit**

```bash
git add backend/api/admin.py tests/backend/test_api_admin.py
git commit -m "feat: add POST /admin/users/{id}/message endpoint"
```

---

## Task 4: Frontend API-Funktion

**Files:**
- Modify: `frontend/src/api/users.ts`

- [ ] **Schritt 1: Funktion `sendUserMessage` in `frontend/src/api/users.ts` anfügen**

```typescript
export async function sendUserMessage(id: string, subject: string, content: string): Promise<void> {
  await apiFetch<{ detail: string }>(`/api/admin/users/${id}/message`, {
    method: 'POST',
    body: JSON.stringify({ subject, content }),
  })
}
```

- [ ] **Schritt 2: TypeScript-Build prüfen**

```bash
cd frontend && npx tsc --noEmit
```

Erwartet: kein Fehler

- [ ] **Schritt 3: Commit**

```bash
git add frontend/src/api/users.ts
git commit -m "feat: add sendUserMessage API function"
```

---

## Task 5: Frontend UI — Button und Modal

**Files:**
- Modify: `frontend/src/components/UserManagementSection.tsx`

- [ ] **Schritt 1: Import erweitern**

Zeile 2 (vorher):
```typescript
import { listUsers, setUserActive, setUserLimit } from '../api/users'
```

Zeile 2 (nachher):
```typescript
import { listUsers, setUserActive, setUserLimit, sendUserMessage } from '../api/users'
```

- [ ] **Schritt 2: Neue State-Variablen hinzufügen**

Nach Zeile 18 (`const [pendingLimit, ...`) einfügen:

```typescript
const [messagingUser, setMessagingUser] = useState<UserRecord | null>(null)
const [messageSubject, setMessageSubject] = useState('')
const [messageContent, setMessageContent] = useState('')
const [messageError, setMessageError] = useState<string | null>(null)
const [messageSending, setMessageSending] = useState(false)
```

- [ ] **Schritt 3: Handler-Funktion hinzufügen**

Nach `handleConfirmLimit` (nach Zeile 87) einfügen:

```typescript
function openMessageModal(user: UserRecord) {
  setMessagingUser(user)
  setMessageSubject('')
  setMessageContent('')
  setMessageError(null)
}

function closeMessageModal() {
  setMessagingUser(null)
  setMessageSubject('')
  setMessageContent('')
  setMessageError(null)
  setMessageSending(false)
}

async function handleSendMessage() {
  if (!messagingUser || !messageSubject.trim() || !messageContent.trim()) return
  setMessageSending(true)
  setMessageError(null)
  try {
    await sendUserMessage(messagingUser.id, messageSubject.trim(), messageContent.trim())
    closeMessageModal()
  } catch {
    setMessageError('Nachricht konnte nicht gesendet werden.')
    setMessageSending(false)
  }
}
```

- [ ] **Schritt 4: "Nachricht"-Button auf der User-Karte hinzufügen**

Im JSX der User-Karte den rechten Bereich anpassen. Den bestehenden Button-Bereich (Zeile ~198):

```tsx
<button
  disabled={isSelf}
  onClick={() => handleToggle(user)}
  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
    isSelf
      ? 'opacity-40 cursor-not-allowed bg-slate-700 text-slate-400'
      : user.active
      ? 'bg-red-900 hover:bg-red-700 text-red-300'
      : 'bg-green-900 hover:bg-green-700 text-green-300'
  }`}
>
  {user.active ? 'Deaktivieren' : 'Aktivieren'}
</button>
```

ersetzen durch:

```tsx
<div className="flex items-center gap-2">
  <button
    onClick={() => openMessageModal(user)}
    className="px-3 py-1 rounded-md text-sm font-medium transition-colors bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
  >
    Nachricht
  </button>
  <button
    disabled={isSelf}
    onClick={() => handleToggle(user)}
    className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
      isSelf
        ? 'opacity-40 cursor-not-allowed bg-slate-700 text-slate-400'
        : user.active
        ? 'bg-red-900 hover:bg-red-700 text-red-300'
        : 'bg-green-900 hover:bg-green-700 text-green-300'
    }`}
  >
    {user.active ? 'Deaktivieren' : 'Aktivieren'}
  </button>
</div>
```

- [ ] **Schritt 5: Nachrichten-Modal am Ende der Komponente hinzufügen**

Direkt vor dem schließenden `</div>` der gesamten Komponente (nach dem `pendingLimit`-Block, vor dem letzten `</div>`) einfügen:

```tsx
{messagingUser && (
  <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
    <div className="bg-surface-card border border-slate-700 rounded-xl p-6 max-w-sm w-full mx-4">
      <p className="text-white font-semibold mb-4">Nachricht an {messagingUser.email}</p>
      <div className="flex flex-col gap-3 mb-4">
        <input
          type="text"
          value={messageSubject}
          onChange={e => setMessageSubject(e.target.value)}
          placeholder="Betreff"
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
        />
        <textarea
          value={messageContent}
          onChange={e => setMessageContent(e.target.value)}
          placeholder="Nachricht"
          rows={5}
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 resize-none"
        />
      </div>
      {messageError && (
        <p className="text-red-400 text-sm mb-3">{messageError}</p>
      )}
      <div className="flex justify-end gap-3">
        <button
          onClick={closeMessageModal}
          disabled={messageSending}
          className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors disabled:opacity-40"
        >
          Abbrechen
        </button>
        <button
          onClick={handleSendMessage}
          disabled={messageSending || !messageSubject.trim() || !messageContent.trim()}
          className="px-4 py-2 text-sm bg-teal-900 hover:bg-teal-800 text-teal-300 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {messageSending ? 'Wird gesendet…' : 'Senden'}
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Schritt 6: TypeScript-Build prüfen**

```bash
cd frontend && npx tsc --noEmit
```

Erwartet: kein Fehler

- [ ] **Schritt 7: Dev-Server starten und Feature manuell testen**

```bash
# Terminal 1 — Backend
DATABASE_URL=sqlite:///eversports.db \
  JWT_SECRET=test-secret \
  ENCRYPTION_KEY=$(python -c 'import os; print(os.urandom(32).hex())') \
  FRONTEND_URL=http://localhost:5173 \
  uvicorn backend.main:app --reload

# Terminal 2 — Frontend
cd frontend && npm run dev
```

Testschritte:
1. Als Admin einloggen → Dashboard → Users-Tab öffnen
2. "Nachricht"-Button auf einer User-Karte klicken → Modal erscheint mit E-Mail-Adresse im Titel
3. "Senden"-Button ist deaktiviert solange Betreff oder Inhalt leer sind
4. Betreff und Inhalt ausfüllen → "Senden" aktiviert sich
5. "Abbrechen" schließt Modal ohne Fehler
6. Bei konfigurierten E-Mail-Credentials: Nachricht absenden → Modal schließt sich

- [ ] **Schritt 8: Commit**

```bash
git add frontend/src/components/UserManagementSection.tsx
git commit -m "feat: add message button and modal to user cards"
```

---

## Task 6: Gesamte Testsuite

- [ ] **Schritt 1: Alle Backend-Tests ausführen**

```bash
pytest tests/ -v
```

Erwartet: alle `PASSED`

- [ ] **Schritt 2: Frontend-Tests ausführen**

```bash
cd frontend && npm test
```

Erwartet: alle `PASSED`
