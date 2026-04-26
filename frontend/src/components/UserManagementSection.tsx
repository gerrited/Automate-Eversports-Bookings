import { useState, useEffect, useCallback } from 'react'
import { listUsers, setUserActive, setUserLimit, sendUserMessage } from '../api/users'
import { getEmail } from '../api/client'
import type { UserRecord } from '../types'

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
            <input
              type="text"
              value={emailFilter}
              onChange={e => handleFilterChange(e.target.value)}
              placeholder="Nach E-Mail filtern…"
              className="flex-1 bg-surface-card border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-slate-500"
            />
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
                          className="w-12 px-1 py-0.5 text-xs bg-slate-800 border border-slate-600 rounded text-center text-white focus:outline-none focus:border-violet-500"
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
              </div>
            )
          })}
          <div className="flex items-center justify-center gap-3 mt-2">
            <button
              disabled={safePage === 1}
              onClick={() => setCurrentPage(p => p - 1)}
              className="px-3 py-1 rounded-md text-sm bg-surface-card text-slate-400 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-slate-700 transition-colors"
            >
              ← Zurück
            </button>
            <button
              disabled={safePage === totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
              className="px-3 py-1 rounded-md text-sm bg-surface-card text-slate-400 border border-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:enabled:bg-slate-700 transition-colors"
            >
              Weiter →
            </button>
          </div>
        </div>
      )}
      {pendingLimit && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-surface-card border border-slate-700 rounded-xl p-6 max-w-sm w-full mx-4">
            <p className="text-white font-semibold mb-3">Alle Jobs werden deaktiviert</p>
            <p className="text-slate-400 text-sm mb-5">
              Das neue Limit von{' '}
              <strong className="text-white">{pendingLimit.value}</strong> liegt unter den aktuell{' '}
              <strong className="text-white">{pendingLimit.user.active_job_count}</strong> aktiven Jobs von{' '}
              <strong className="text-white">{pendingLimit.user.email}</strong>. Alle aktiven Jobs werden deaktiviert und der Benutzer per E-Mail informiert.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setPendingLimit(null)}
                className="px-4 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors"
              >
                Abbrechen
              </button>
              <button
                onClick={handleConfirmLimit}
                className="px-4 py-2 text-sm bg-red-900 hover:bg-red-700 text-red-300 rounded-lg transition-colors"
              >
                Ja, Limit setzen
              </button>
            </div>
          </div>
        </div>
      )}
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
    </div>
  )
}
