import { useState, useEffect, useCallback } from 'react'
import { listUsers, setUserActive, setUserLimit, sendUserMessage, sendTestPush } from '../api/users'
import { getEmail } from '../api/client'
import type { UserRecord } from '../types'
import { AlertMessage, Button, Input, ModalShell } from './ui'

const PAGE_SIZE = 25

export default function UserManagementSection({ onJobsClick, initialEmailFilter }: { onJobsClick?: (email: string) => void; initialEmailFilter?: string } = {}) {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [emailFilter, setEmailFilter] = useState(initialEmailFilter ?? '')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const currentEmail = getEmail()
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [editingLimitUserId, setEditingLimitUserId] = useState<string | null>(null)
  const [limitInputValue, setLimitInputValue] = useState('')
  const [pendingLimit, setPendingLimit] = useState<{ user: UserRecord; value: number | null } | null>(null)
  const [messagingUser, setMessagingUser] = useState<UserRecord | null>(null)
  const [messageSubject, setMessageSubject] = useState('')
  const [messageContent, setMessageContent] = useState('')
  const [messageError, setMessageError] = useState<string | null>(null)
  const [messageSending, setMessageSending] = useState(false)
  const [messageSent, setMessageSent] = useState(false)
  const [pushingUserId, setPushingUserId] = useState<string | null>(null)
  const [pushSuccessUserId, setPushSuccessUserId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setUsers(await listUsers())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (initialEmailFilter !== undefined) {
      setEmailFilter(initialEmailFilter)
      setCurrentPage(1)
    }
  }, [initialEmailFilter])

  function handleFilterChange(value: string) {
    setEmailFilter(value)
    setCurrentPage(1)
  }

  function handleActiveFilterCycle() {
    setActiveFilter(f => f === 'all' ? 'active' : f === 'active' ? 'inactive' : 'all')
    setCurrentPage(1)
  }

  async function handleToggle(user: UserRecord) {
    if (user.email === currentEmail && user.active) return
    const newActive = !user.active
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, active: newActive } : u))
    try {
      await setUserActive(user.id, newActive)
    } catch {
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, active: user.active } : u))
      setToggleError(`Fehler beim ${newActive ? 'Aktivieren' : 'Deaktivieren'} von ${user.email}.`)
    }
  }

  function startEditLimit(user: UserRecord) {
    setEditingLimitUserId(user.id)
    setLimitInputValue(user.max_active_jobs !== null ? String(user.max_active_jobs) : '')
  }

  function cancelEditLimit() {
    setEditingLimitUserId(null)
    setLimitInputValue('')
  }

  async function handleSaveLimit(user: UserRecord) {
    const trimmed = limitInputValue.trim()
    const newLimit = trimmed === '' ? null : parseInt(trimmed, 10)
    if (newLimit !== null && (isNaN(newLimit) || newLimit < 1)) return
    cancelEditLimit()
    if (newLimit !== null && user.active_job_count > newLimit) {
      setPendingLimit({ user, value: newLimit })
      return
    }
    await setUserLimit(user.id, newLimit)
    load()
  }

  async function handleConfirmLimit() {
    if (!pendingLimit) return
    await setUserLimit(pendingLimit.user.id, pendingLimit.value)
    setPendingLimit(null)
    load()
  }

  function openMessageModal(user: UserRecord) {
    setMessagingUser(user)
    setMessageSubject('')
    setMessageContent('')
    setMessageError(null)
    setMessageSent(false)
  }

  function closeMessageModal() {
    setMessagingUser(null)
    setMessageSubject('')
    setMessageContent('')
    setMessageError(null)
    setMessageSending(false)
    setMessageSent(false)
  }

  async function handleSendTestPush(userId: string) {
    setPushingUserId(userId)
    try {
      await sendTestPush(userId)
      setPushSuccessUserId(userId)
      setTimeout(() => setPushSuccessUserId(null), 2000)
    } catch {
      // Admin-Werkzeug: kein UI-Fehler
    } finally {
      setPushingUserId(null)
    }
  }

  async function handleSendMessage() {
    if (!messagingUser || !messageSubject.trim() || !messageContent.trim()) return
    setMessageSending(true)
    setMessageError(null)
    try {
      await sendUserMessage(messagingUser.id, messageSubject.trim(), messageContent.trim())
      setMessageSent(true)
      setMessageSending(false)
    } catch {
      setMessageError('Nachricht konnte nicht gesendet werden.')
      setMessageSending(false)
    }
  }

  const filteredUsers = users
    .filter(u => activeFilter === 'all' || (activeFilter === 'active' ? u.active : !u.active))
    .filter(u => emailFilter.length < 1 || u.email.toLowerCase().includes(emailFilter.toLowerCase()))

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE))
  const safePage = Math.min(currentPage, totalPages)
  const pagedUsers = filteredUsers.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  )

  return (
    <div>
      {loading && <p className="text-slate-400 text-sm">Lädt…</p>}
      {!loading && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                variant="filter"
                type="text"
                value={emailFilter}
                onChange={e => handleFilterChange(e.target.value)}
                placeholder="Nach E-Mail filtern…"
              />
            </div>
            <button
              onClick={handleActiveFilterCycle}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                activeFilter === 'active'
                  ? 'bg-green-900 border-green-700 text-green-300'
                  : activeFilter === 'inactive'
                  ? 'bg-red-900 border-red-700 text-red-300'
                  : 'bg-surface-card border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
            >
              {activeFilter === 'active' ? 'Aktiv' : activeFilter === 'inactive' ? 'Inaktiv' : 'Alle'}
            </button>
          </div>
          {toggleError && (
            <div className="flex items-center justify-between bg-red-950 border border-red-700 rounded-lg px-3 py-2">
              <p className="text-red-300 text-sm">{toggleError}</p>
              <button onClick={() => setToggleError(null)} className="text-red-400 hover:text-red-200 ml-3 text-xs">✕</button>
            </div>
          )}
          <p className="text-slate-500 text-xs">
            {filteredUsers.length} von {users.length} Benutzern · Seite {safePage} von {totalPages}
          </p>
          {pagedUsers.map(user => {
            const isSelf = user.email === currentEmail
            return (
              <div
                key={user.id}
                className="bg-surface-card rounded-xl px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-white text-sm">{user.email}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <span className="text-slate-400 text-xs">
                      {user.role === 'admin' ? 'Admin' : 'User'} ·{' '}
                      {user.active ? 'Aktiv' : 'Inaktiv'} ·{' '}
                      {onJobsClick && user.job_count > 0 ? (
                        <button
                          aria-label={`Jobs von ${user.email} anzeigen`}
                          onClick={() => onJobsClick(user.email)}
                          className="text-white underline cursor-pointer hover:opacity-80 transition-opacity"
                        >
                          {user.job_count} {user.job_count === 1 ? 'Job' : 'Jobs'}
                        </button>
                      ) : (
                        <>{user.job_count} {user.job_count === 1 ? 'Job' : 'Jobs'}</>
                      )}
                    </span>
                    {editingLimitUserId === user.id ? (
                      <span className="inline-flex items-center gap-1">
                        <input
                          type="number"
                          min="1"
                          value={limitInputValue}
                          onChange={e => setLimitInputValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') handleSaveLimit(user)
                            if (e.key === 'Escape') cancelEditLimit()
                          }}
                          placeholder="∞"
                          className="w-12 px-1 py-0.5 text-xs bg-slate-800 border border-slate-700 rounded text-center text-white focus:outline-none focus:border-violet-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveLimit(user)}
                          className="text-xs text-green-400 hover:text-green-300 px-1"
                        >✓</button>
                        <button
                          onClick={cancelEditLimit}
                          className="text-xs text-slate-500 hover:text-slate-400 px-1"
                        >✕</button>
                      </span>
                    ) : (
                      <button
                        onClick={() => startEditLimit(user)}
                        className={`text-xs px-2 py-0.5 rounded-full border cursor-pointer hover:opacity-80 transition-opacity ${
                          user.max_active_jobs !== null
                            ? 'bg-violet-900/50 border-violet-700 text-violet-300'
                            : 'bg-slate-800 border-slate-700 text-slate-500'
                        }`}
                      >
                        {user.max_active_jobs !== null ? `Limit: ${user.max_active_jobs} ✎` : 'Kein Limit ✎'}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="slate"
                    size="sm"
                    aria-label="Test-Push senden"
                    disabled={user.push_subscription_count === 0 || pushingUserId === user.id}
                    title={user.push_subscription_count === 0 ? 'Kein Gerät registriert' : undefined}
                    onClick={() => handleSendTestPush(user.id)}
                  >
                    {pushSuccessUserId === user.id ? (
                      <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0z" clipRule="evenodd"/>
                      </svg>
                    ) : (
                      <>
                        <svg className="sm:hidden w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 2a6 6 0 0 0-6 6v3.586l-.707.707A1 1 0 0 0 4 14h12a1 1 0 0 0 .707-1.707L16 11.586V8a6 6 0 0 0-6-6zm0 16a2 2 0 0 1-2-2h4a2 2 0 0 1-2 2z"/>
                        </svg>
                        <span className="hidden sm:inline">Push</span>
                      </>
                    )}
                  </Button>
                  <Button
                    variant="slate"
                    size="sm"
                    aria-label="Nachricht senden"
                    onClick={() => openMessageModal(user)}
                  >
                    <svg className="sm:hidden w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M2.003 5.884 10 9.882l7.997-3.998A2 2 0 0 0 16 4H4a2 2 0 0 0-1.997 1.884z"/><path d="m18 8.118-8 4-8-4V14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.118z"/></svg>
                    <span className="hidden sm:inline">Nachricht</span>
                  </Button>
                  {user.active ? (
                    <Button
                      variant="danger"
                      size="sm"
                      disabled={isSelf}
                      aria-label="Deaktivieren"
                      onClick={() => handleToggle(user)}
                    >
                      <svg className="sm:hidden w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M4.293 4.293a1 1 0 0 1 1.414 0L10 8.586l4.293-4.293a1 1 0 1 1 1.414 1.414L11.414 10l4.293 4.293a1 1 0 0 1-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 0 1-1.414-1.414L8.586 10 4.293 5.707a1 1 0 0 1 0-1.414z" clipRule="evenodd"/>
                      </svg>
                      <span className="hidden sm:inline">Deaktivieren</span>
                    </Button>
                  ) : (
                    <Button
                      variant="success"
                      size="sm"
                      disabled={isSelf}
                      aria-label="Aktivieren"
                      onClick={() => handleToggle(user)}
                    >
                      <svg className="sm:hidden w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0z" clipRule="evenodd"/>
                      </svg>
                      <span className="hidden sm:inline">Aktivieren</span>
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
          <div className="flex items-center justify-center gap-3 mt-2">
            <Button variant="secondary" size="sm" disabled={safePage === 1} onClick={() => setCurrentPage(p => p - 1)}>
              ← Zurück
            </Button>
            <Button variant="secondary" size="sm" disabled={safePage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
              Weiter →
            </Button>
          </div>
        </div>
      )}
      {pendingLimit && (
        <ModalShell maxWidth="sm">
            <p className="text-white font-semibold mb-3">Alle Jobs werden deaktiviert</p>
            <p className="text-slate-400 text-sm mb-5">
              Das neue Limit von{' '}
              <strong className="text-white">{pendingLimit.value}</strong> liegt unter den aktuell{' '}
              <strong className="text-white">{pendingLimit.user.active_job_count}</strong> aktiven Jobs von{' '}
              <strong className="text-white">{pendingLimit.user.email}</strong>. Alle aktiven Jobs werden deaktiviert und der Benutzer per E-Mail informiert.
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="ghost" onClick={() => setPendingLimit(null)}>
                Abbrechen
              </Button>
              <Button variant="danger" onClick={handleConfirmLimit}>
                Ja, Limit setzen
              </Button>
            </div>
        </ModalShell>
      )}
      {messagingUser && (
        <ModalShell maxWidth="sm">
            {messageSent ? (
              <>
                <p className="text-white font-semibold mb-3">Nachricht gesendet</p>
                <div className="bg-teal-950 border-l-3 border-teal-500 rounded-r-md px-4 py-3 mb-5 text-sm text-teal-300">
                  Die Nachricht wurde an {messagingUser.email} gesendet.
                </div>
                <div className="flex justify-end">
                  <Button variant="primary" onClick={closeMessageModal}>
                    Schließen
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="text-white font-semibold mb-4">Nachricht an {messagingUser.email}</p>
                <div className="flex flex-col gap-3 mb-4">
                  <Input
                    variant="filter"
                    type="text"
                    value={messageSubject}
                    onChange={e => setMessageSubject(e.target.value)}
                    placeholder="Betreff"
                  />
                  <textarea
                    value={messageContent}
                    onChange={e => setMessageContent(e.target.value)}
                    placeholder="Nachricht"
                    rows={5}
                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500 resize-none"
                  />
                </div>
                {messageError && (
                  <AlertMessage type="error" className="mb-3">{messageError}</AlertMessage>
                )}
                <div className="flex justify-end gap-3">
                  <Button variant="primary" loading={messageSending} disabled={!messageSubject.trim() || !messageContent.trim()} onClick={handleSendMessage}>
                    Senden
                  </Button>
                  <Button variant="ghost" disabled={messageSending} onClick={closeMessageModal}>
                    Abbrechen
                  </Button>
                </div>
              </>
            )}
        </ModalShell>
      )}
    </div>
  )
}
