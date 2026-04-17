import { useState, useEffect, useCallback } from 'react'
import { listUsers, setUserActive } from '../api/users'
import { getEmail } from '../api/client'
import type { UserRecord } from '../types'

const PAGE_SIZE = 25

export default function UserManagementSection() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [emailFilter, setEmailFilter] = useState('')
  const [showInactiveOnly, setShowInactiveOnly] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const currentEmail = getEmail()

  const load = useCallback(async () => {
    try {
      setUsers(await listUsers())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  function handleFilterChange(value: string) {
    setEmailFilter(value)
    setCurrentPage(1)
  }

  function handleInactiveToggle() {
    setShowInactiveOnly(v => !v)
    setCurrentPage(1)
  }

  async function handleToggle(user: UserRecord) {
    if (user.email === currentEmail && user.active) return
    await setUserActive(user.id, !user.active)
    load()
  }

  const filteredUsers = users
    .filter(u => !showInactiveOnly || !u.active)
    .filter(u => emailFilter.length < 3 || u.email.toLowerCase().includes(emailFilter.toLowerCase()))

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
              onClick={handleInactiveToggle}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                showInactiveOnly
                  ? 'bg-amber-900 border-amber-700 text-amber-300'
                  : 'bg-surface-card border-slate-700 text-slate-400 hover:bg-slate-700'
              }`}
            >
              Ausstehend
            </button>
          </div>
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
                  <p className="text-slate-400 text-xs">
                    {user.role === 'admin' ? 'Admin' : 'User'} ·{' '}
                    {user.active ? 'Aktiv' : 'Inaktiv'} ·{' '}
                    {user.job_count} {user.job_count === 1 ? 'Job' : 'Jobs'}
                  </p>
                </div>
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
    </div>
  )
}
