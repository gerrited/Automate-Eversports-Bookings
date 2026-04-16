import { useState, useEffect, useCallback } from 'react'
import { listUsers, setUserActive } from '../api/users'
import { getEmail } from '../api/client'
import type { UserRecord } from '../types'

export default function UserManagementSection() {
  const [users, setUsers] = useState<UserRecord[]>([])
  const [loading, setLoading] = useState(true)
  const currentEmail = getEmail()

  const load = useCallback(async () => {
    try {
      setUsers(await listUsers())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleToggle(user: UserRecord) {
    if (user.email === currentEmail && user.active) return // guard: can't deactivate self
    await setUserActive(user.id, !user.active)
    load()
  }

  return (
    <div>
      {loading && <p className="text-slate-400 text-sm">Lädt…</p>}
      {!loading && (
        <div className="flex flex-col gap-2">
          {users.map(user => {
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
                      ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                      : 'bg-brand hover:bg-brand-hover text-white'
                  }`}
                >
                  {user.active ? 'Deaktivieren' : 'Aktivieren'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
