import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { isAdmin, isActualAdmin, getEmail, getAvatarUrl } from '../api/client'
import { logout } from '../api/auth'
import { listJobs, createJob, updateJob, toggleJob, deleteJob, getJobLogs, executeJob } from '../api/jobs'
import type { Job, BookingLog, JobFormData } from '../types'
import JobCard from '../components/JobCard'
import JobModal from '../components/JobModal'
import LogDrawer from '../components/LogDrawer'
import UserManagementSection from '../components/UserManagementSection'
import AllJobsSection from '../components/AllJobsSection'
import AllLogsSection from '../components/AllLogsSection'
import HamburgerMenu from '../components/HamburgerMenu'
import SettingsModal from '../components/SettingsModal'
import TestEmailModal from '../components/TestEmailModal'
import { getUpcomingBookings, cancelBooking } from '../api/bookedAppointments'
import { getMe } from '../api/account'
import BookedAppointmentCard from '../components/BookedAppointmentCard'
import Logo from '../components/Logo'
import type { BookedAppointment } from '../types'
import { usePushNotifications } from '../hooks/usePushNotifications'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { hash } = useLocation()
  const activeTab: 'geplant' | 'gebucht' | 'users' | 'jobs' | 'logs' =
    hash === '#users' ? 'users'
    : hash === '#all-jobs' ? 'jobs'
    : hash === '#logs' ? 'logs'
    : hash === '#booked' ? 'gebucht'
    : 'geplant'

  function setActiveTab(tab: 'geplant' | 'gebucht' | 'users' | 'jobs' | 'logs', clearFilters = false) {
    if (clearFilters) {
      setJobsEmailFilter('')
      setUsersEmailFilter('')
    }
    navigate(
      tab === 'users' ? '#users'
      : tab === 'jobs' ? '#all-jobs'
      : tab === 'logs' ? '#logs'
      : tab === 'gebucht' ? '#booked'
      : '#bookings',
      { replace: true }
    )
  }

  const [jobs, setJobs] = useState<Job[]>([])
  const [bookedAppointments, setBookedAppointments] = useState<BookedAppointment[]>([])
  const [bookedLoaded, setBookedLoaded] = useState(false)
  const [bookedLoading, setBookedLoading] = useState(false)
  const [bookedError, setBookedError] = useState<string | null>(null)
  const bookedPrefetch = useRef<Promise<BookedAppointment[]> | null>(null)
  const [loading, setLoading] = useState(true)
  const [editingJob, setEditingJob] = useState<Job | 'new' | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [logs, setLogs] = useState<BookingLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showTestEmailModal, setShowTestEmailModal] = useState(false)
  const [jobsEmailFilter, setJobsEmailFilter] = useState('')
  const [usersEmailFilter, setUsersEmailFilter] = useState('')
  const [debugFilter, setDebugFilter] = useState<'live' | 'debug'>('live')

  const [tick, forceUpdate] = useState(0)

  const [totalBookingsExecuted, setTotalBookingsExecuted] = useState<number>(0)
  const [maxActiveJobs, setMaxActiveJobs] = useState<number | null | undefined>(undefined)

  usePushNotifications()

  useEffect(() => {
    getMe().then(data => {
      setTotalBookingsExecuted(data.total_bookings_executed)
      setMaxActiveJobs(data.max_active_jobs)
    }).catch(() => {})
  }, [])

  useEffect(() => {
    bookedPrefetch.current = getUpcomingBookings()
  }, [])

  useEffect(() => {
    function onAuthChanged() {
      forceUpdate(n => n + 1)
      const h = window.location.hash
      if (!isAdmin() && (h === '#users' || h === '#all-jobs' || h === '#logs')) {
        navigate('#bookings', { replace: true })
      }
    }
    window.addEventListener('auth-changed', onAuthChanged)
    return () => window.removeEventListener('auth-changed', onAuthChanged)
  }, [navigate])

  function handleUserJobsClick(email: string) {
    setJobsEmailFilter(email)
    setActiveTab('jobs')
  }

  function handleJobUserClick(email: string) {
    setUsersEmailFilter(email)
    setActiveTab('users')
  }

  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
useEffect(() => {
    function onTouchStart(e: TouchEvent) {
      touchStartX.current = e.touches[0].clientX
      touchStartY.current = e.touches[0].clientY
    }

    function onTouchEnd(e: TouchEvent) {
      if (touchStartX.current === null || touchStartY.current === null) return
      const dx = e.changedTouches[0].clientX - touchStartX.current
      const dy = e.changedTouches[0].clientY - touchStartY.current
      touchStartX.current = null
      touchStartY.current = null
      if (Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy)) return
      const tabs = isAdmin() ? ['#bookings', '#booked', '#users', '#all-jobs', '#logs'] : ['#bookings', '#booked']
      const currentIndex = tabs.indexOf(window.location.hash || '#bookings')
      const nextIndex = dx < 0
        ? Math.min(currentIndex + 1, tabs.length - 1)
        : Math.max(currentIndex - 1, 0)
      window.location.hash = tabs[nextIndex]
    }

    document.addEventListener('touchstart', onTouchStart)
    document.addEventListener('touchend', onTouchEnd)
    return () => {
      document.removeEventListener('touchstart', onTouchStart)
      document.removeEventListener('touchend', onTouchEnd)
    }
  }, [tick])

  const loadJobs = useCallback(async () => {
    try {
      setJobs(await listJobs())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadJobs() }, [loadJobs])

  useEffect(() => {
    if (activeTab !== 'gebucht') return
    if (bookedLoaded) return
    setBookedLoaded(true)
    setBookedLoading(true)
    setBookedError(null)
    ;(bookedPrefetch.current ?? getUpcomingBookings())
      .then(setBookedAppointments)
      .catch((e) => setBookedError(e instanceof Error ? e.message : 'Fehler beim Laden'))
      .finally(() => setBookedLoading(false))
  }, [activeTab, bookedLoaded])

  async function handleCancelBooking(booking: BookedAppointment) {
    await cancelBooking(booking.event_participant_id, {
      event_id: booking.event_id,
      facility_id: booking.facility_id,
      session_id: booking.session_id,
    })
    setBookedAppointments((prev) =>
      prev.filter((b) => b.event_participant_id !== booking.event_participant_id)
    )
  }

  async function handleLogout() {
    await logout()
    navigate('/')
  }

  async function handleSave(data: JobFormData) {
    setSaveError(null)
    try {
      if (editingJob === 'new' || editingJob === null) {
        await createJob(data)
      } else {
        await updateJob(editingJob.id, data)
      }
      setShowModal(false)
      setEditingJob(null)
      loadJobs()
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Fehler beim Speichern.')
    }
  }

  async function handleToggle(id: string) {
    await toggleJob(id)
    loadJobs()
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Geplante Buchung wirklich löschen?')) return
    await deleteJob(id)
    loadJobs()
  }

  async function handleSelect(job: Job) {
    setSelectedJob(job)
    setLogsLoading(true)
    setLogs([])
    try {
      setLogs(await getJobLogs(job.id))
    } finally {
      setLogsLoading(false)
    }
  }

  async function handleExecute(id: string) {
    return await executeJob(id)
  }

  const TABS: { id: 'geplant' | 'gebucht' | 'users' | 'jobs' | 'logs'; label: string }[] = [
    { id: 'geplant', label: 'Geplant' },
    { id: 'gebucht', label: 'Gebucht' },
    ...(isAdmin()
      ? [
          { id: 'users' as const, label: 'Users' },
          { id: 'jobs' as const, label: 'Jobs' },
          { id: 'logs' as const, label: 'Logs' },
        ]
      : []),
  ]

  const visibleJobs = [...jobs]
    .filter(job => debugFilter === 'debug' ? job.debug : !job.debug)
    .sort((a, b) =>
      a.weekday - b.weekday ||
      a.target_time.localeCompare(b.target_time) ||
      a.facility_name.localeCompare(b.facility_name, 'de') ||
      a.class_name.localeCompare(b.class_name, 'de')
    )
  const activeCount = visibleJobs.filter(j => j.enabled).length

  return (
    <div className="flex-1 flex flex-col bg-surface-page">
      <div aria-hidden style={{ height: 'var(--notice-height, 0px)' }} />

      <header
        className="sticky z-20 border-b border-line-subtle bg-surface-page/95 backdrop-blur-md"
        style={{ top: 'var(--notice-height, 0px)' }}
      >
        <div className="max-w-[1120px] mx-auto px-4 sm:px-5 pt-3.5 sm:pt-[18px] flex flex-col gap-3.5 sm:gap-[18px]">
          <div className="flex justify-between items-center gap-4">
            <button type="button" aria-label="Zur Übersicht" onClick={() => navigate('/dashboard')}>
              <Logo />
            </button>
            <HamburgerMenu
              onLogout={handleLogout}
              onSettings={() => setShowSettings(true)}
              onTestEmails={() => setShowTestEmailModal(true)}
              userEmail={getEmail()}
              userAvatar={getAvatarUrl()}
              isActualAdmin={isActualAdmin()}
              isAdminView={isAdmin()}
              maxActiveJobs={maxActiveJobs}
            />
          </div>

          {/* Tab-Navigation – Geplant/Gebucht für alle, Users/Jobs/Logs nur für Admins */}
          <nav aria-label="Bereiche" className="flex gap-1 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {TABS.map(({ id, label }) => {
              const on = activeTab === id
              return (
                <button
                  key={id}
                  type="button"
                  aria-current={on ? 'page' : undefined}
                  onClick={() => setActiveTab(id, true)}
                  className={`shrink-0 min-h-[46px] px-5 rounded-t-xl text-[15px] font-bold transition-colors ${
                    on
                      ? 'bg-brand text-white shadow-[inset_0_-2px_0_var(--color-accent)]'
                      : 'text-muted hover:text-[#f2f7f7]'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </nav>
        </div>
      </header>

    <main className="flex-1 w-full max-w-[1120px] mx-auto px-4 sm:px-5 pt-7 sm:pt-9 pb-14">

      {/* Geplant-Tab */}
      {activeTab === 'geplant' && (
        <div className="flex flex-col gap-7">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div className="flex flex-col gap-1.5">
              <h1 className="text-[28px] sm:text-[32px] font-extrabold tracking-[-0.025em] text-white">
                Geplante Buchungen
              </h1>
              {!loading && visibleJobs.length > 0 && (
                <p className="text-base text-muted">
                  {activeCount} von {visibleJobs.length} aktiv · die App bucht diese Termine automatisch für dich.
                </p>
              )}
            </div>
            <div className="flex gap-2.5 w-full sm:w-auto">
              {isAdmin() && (
                <button
                  type="button"
                  onClick={() => setDebugFilter(f => f === 'live' ? 'debug' : 'live')}
                  className={`min-h-[50px] px-5 rounded-[14px] text-sm font-bold transition-colors ${
                    debugFilter === 'debug'
                      ? 'bg-amber-500 hover:bg-amber-400 text-surface-page'
                      : 'bg-slate-700 hover:bg-[#3e4c63] text-slate-200'
                  }`}
                >
                  {debugFilter === 'debug' ? 'Test' : 'Live'}
                </button>
              )}
              <button
                type="button"
                onClick={() => { setEditingJob('new'); setShowModal(true) }}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 min-h-[50px] px-[22px] rounded-[14px] bg-brand hover:bg-brand-hover hover:shadow-[0_10px_30px_rgba(0,67,73,.45)] text-white text-base font-bold transition-[background-color,box-shadow]"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
                Buchung planen
              </button>
            </div>
          </div>

          {totalBookingsExecuted > 0 && (
            <div className="flex items-center gap-4 rounded-[18px] border border-[#13363c] bg-[#062228] px-5 py-4 sm:px-[22px] sm:py-[18px]">
              <span className="shrink-0 w-11 h-11 rounded-xl bg-brand text-accent flex items-center justify-center">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>
              </span>
              <p className="text-base leading-normal text-slate-300">
                Für dich wurde{totalBookingsExecuted === 1 ? '' : 'n'} bereits{' '}
                <strong className="text-xl text-white">{totalBookingsExecuted}</strong>{' '}
                Buchung{totalBookingsExecuted === 1 ? '' : 'en'} automatisch durchgeführt.
              </p>
            </div>
          )}

          {loading && <p className="text-muted text-sm">Lädt…</p>}

          {!loading && visibleJobs.length === 0 && (
            <div className="flex flex-col items-center gap-2.5 rounded-[20px] border border-dashed border-line-strong px-6 py-12 text-center">
              <span className="text-lg font-bold text-white">Noch keine Buchung geplant</span>
              <span className="text-[15px] text-muted">Plane deine erste Buchung – die App erledigt den Rest.</span>
            </div>
          )}

          {visibleJobs.length > 0 && (
            <div className="grid gap-[18px] md:grid-cols-2">
              {visibleJobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  onToggle={handleToggle}
                  onEdit={j => { setEditingJob(j); setShowModal(true) }}
                  onDelete={handleDelete}
                  onSelect={handleSelect}
                  onExecute={handleExecute}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Gebucht-Tab */}
      {activeTab === 'gebucht' && (
        <div className="flex flex-col gap-7">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-[28px] sm:text-[32px] font-extrabold tracking-[-0.025em] text-white">
              Gebuchte Termine
            </h1>
            <p className="text-base text-muted">Deine bevorstehenden Termine bei Eversports.</p>
          </div>
          {bookedLoading && (
            <p className="text-muted text-sm">Lade Buchungen…</p>
          )}
          {bookedError && (
            <p role="alert" className="rounded-xl border border-red-900 bg-red-900/20 px-4 py-3 text-sm text-red-300">{bookedError}</p>
          )}
          {!bookedLoading && !bookedError && bookedAppointments.length === 0 && (
            <div className="flex flex-col items-center gap-2.5 rounded-[20px] border border-dashed border-line-strong px-6 py-12 text-center">
              <span className="text-lg font-bold text-white">Keine bevorstehenden Buchungen</span>
            </div>
          )}
          {bookedAppointments.length > 0 && (
            <div className="grid gap-[18px] md:grid-cols-2">
              {[...bookedAppointments]
                .sort((a, b) => a.start_datetime.localeCompare(b.start_datetime))
                .map((b) => (
                <BookedAppointmentCard
                  key={b.event_participant_id}
                  booking={b}
                  onCancel={handleCancelBooking}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Admin: Benutzer-Tab */}
      {isAdmin() && activeTab === 'users' && <UserManagementSection onJobsClick={handleUserJobsClick} initialEmailFilter={usersEmailFilter} />}

      {/* Admin: Jobs-Tab */}
      {isAdmin() && activeTab === 'jobs' && <AllJobsSection initialEmailFilter={jobsEmailFilter} onUserClick={handleJobUserClick} />}

      {/* Admin: Logs-Tab */}
      {isAdmin() && activeTab === 'logs' && <AllLogsSection />}

      {/* Modal */}
      {showModal && (
        <JobModal
          job={editingJob !== 'new' && editingJob !== null ? editingJob : undefined}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingJob(null); setSaveError(null) }}
          error={saveError}
        />
      )}

      {/* Log drawer */}
      {selectedJob && (
        <LogDrawer
          job={selectedJob}
          logs={logs}
          loading={logsLoading}
          onClose={() => setSelectedJob(null)}
        />
      )}

      {/* Settings modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}

      {showTestEmailModal && (
        <TestEmailModal onClose={() => setShowTestEmailModal(false)} />
      )}
    </main>
    </div>
  )
}
