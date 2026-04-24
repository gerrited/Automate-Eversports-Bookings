import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { clearToken, isAdmin, isActualAdmin, getEmail, getAvatarUrl } from '../api/client'
import { listJobs, createJob, updateJob, toggleJob, deleteJob, getJobLogs, executeJob } from '../api/jobs'
import type { Job, BookingLog, JobFormData } from '../types'
import JobCard from '../components/JobCard'
import JobModal from '../components/JobModal'
import LogDrawer from '../components/LogDrawer'
import UserManagementSection from '../components/UserManagementSection'
import AllJobsSection from '../components/AllJobsSection'
import HamburgerMenu from '../components/HamburgerMenu'
import SettingsModal from '../components/SettingsModal'
import TestEmailModal from '../components/TestEmailModal'
import { getUpcomingBookings, cancelBooking } from '../api/bookedAppointments'
import BookedAppointmentCard from '../components/BookedAppointmentCard'
import type { BookedAppointment } from '../types'

export default function DashboardPage() {
  const navigate = useNavigate()
  const { hash } = useLocation()
  const activeTab: 'geplant' | 'gebucht' | 'benutzer' | 'jobs' =
    hash === '#users' ? 'benutzer'
    : hash === '#all-jobs' ? 'jobs'
    : hash === '#booked' ? 'gebucht'
    : 'geplant'

  function setActiveTab(tab: 'geplant' | 'gebucht' | 'benutzer' | 'jobs', clearFilters = false) {
    if (clearFilters) {
      setJobsEmailFilter('')
      setUsersEmailFilter('')
    }
    navigate(
      tab === 'benutzer' ? '#users'
      : tab === 'jobs' ? '#all-jobs'
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

  useEffect(() => {
    function onAuthChanged() { forceUpdate(n => n + 1) }
    window.addEventListener('auth-changed', onAuthChanged)
    return () => window.removeEventListener('auth-changed', onAuthChanged)
  }, [])

  function handleUserJobsClick(email: string) {
    setJobsEmailFilter(email)
    setActiveTab('jobs')
  }

  function handleJobUserClick(email: string) {
    setUsersEmailFilter(email)
    setActiveTab('benutzer')
  }

  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
useEffect(() => {
    if (!isAdmin()) return

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
      const tabs = ['#bookings', '#booked', '#users', '#all-jobs']
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
    getUpcomingBookings()
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

  function handleLogout() {
    clearToken()
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

  return (
    <div className="min-h-screen bg-surface-page">
      {/* Fixed Header */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-surface-page border-b border-slate-700/60">
        <div className="px-4 max-w-2xl mx-auto">
          <div className="flex justify-between items-center py-4">
            <img src="/logo.png" alt="Logo" className="h-10 w-auto sm:h-16 cursor-pointer" onClick={() => navigate('/dashboard')} />
            <HamburgerMenu
              onLogout={handleLogout}
              onSettings={() => setShowSettings(true)}
              onTestEmails={() => setShowTestEmailModal(true)}
              userEmail={getEmail()}
              userAvatar={getAvatarUrl()}
              isActualAdmin={isActualAdmin()}
              isAdminView={isAdmin()}
            />
          </div>

          {/* Tab-Navigation – Geplant/Gebucht für alle, Benutzer/Jobs nur für Admins */}
          <div className="flex gap-1 border-b border-slate-700">
            {(['geplant', 'gebucht', ...(isAdmin() ? ['benutzer', 'jobs'] : [])] as ('geplant' | 'gebucht' | 'benutzer' | 'jobs')[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab, true)}
                className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors focus:outline-none
                  ${activeTab === tab
                    ? 'bg-brand text-white border-b-2 border-brand -mb-px'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-surface-card'
                  }`}
              >
                {tab === 'geplant' ? 'Geplant'
                  : tab === 'gebucht' ? 'Gebucht'
                  : tab === 'benutzer' ? 'Benutzer'
                  : 'Jobs'}
              </button>
            ))}
          </div>
        </div>
      </div>

    <div className="px-4 pb-8 max-w-2xl mx-auto pt-32 sm:pt-44">

      {/* Add button – nur auf Geplant-Tab */}
      {activeTab === 'geplant' && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { setEditingJob('new'); setShowModal(true) }}
            className="flex-1 py-3 bg-brand hover:bg-brand-hover text-white font-semibold rounded-xl transition-colors"
          >
            + Buchung planen
          </button>
          {isAdmin() && (
            <button
              onClick={() => setDebugFilter(f => f === 'live' ? 'debug' : 'live')}
              className={`px-4 py-3 rounded-xl text-sm font-semibold transition-colors ${
                debugFilter === 'debug'
                  ? 'bg-amber-500 hover:bg-amber-400 text-white'
                  : 'bg-slate-700 hover:bg-slate-600 text-slate-300'
              }`}
            >
              {debugFilter === 'debug' ? 'Test' : 'Live'}
            </button>
          )}
        </div>
      )}

      {/* Job list – nur auf Geplant-Tab */}
      {activeTab === 'geplant' && (
        <>
          {loading && <p className="text-slate-400 text-sm">Lädt…</p>}
          {!loading && jobs.length === 0 && (
            <p className="text-slate-400 text-sm text-center mt-12">
              Noch keine Buchung geplant.
            </p>
          )}

          <div className="flex flex-col gap-3">
            {[...jobs]
              .filter(job => debugFilter === 'debug' ? job.debug : !job.debug)
              .sort((a, b) =>
                a.weekday - b.weekday ||
                a.target_time.localeCompare(b.target_time) ||
                a.facility_name.localeCompare(b.facility_name, 'de') ||
                a.class_name.localeCompare(b.class_name, 'de')
              ).map(job => (
              <JobCard
                key={job.id}
                job={job}
                onToggle={handleToggle}
                onEdit={j => { setEditingJob(j); setShowModal(true) }}
                onDelete={handleDelete}
                onSelect={handleSelect}
                onExecute={isAdmin() ? handleExecute : undefined}
              />
            ))}
          </div>
        </>
      )}

      {/* Gebucht-Tab */}
      {activeTab === 'gebucht' && (
        <div className="flex flex-col gap-3">
          {bookedLoading && (
            <p className="text-slate-400 text-sm text-center mt-12">Lade Buchungen…</p>
          )}
          {bookedError && (
            <p className="text-red-400 text-sm text-center mt-12">{bookedError}</p>
          )}
          {!bookedLoading && !bookedError && bookedAppointments.length === 0 && (
            <p className="text-slate-400 text-sm text-center mt-12">Keine bevorstehenden Buchungen</p>
          )}
          {bookedAppointments.map((b) => (
            <BookedAppointmentCard
              key={b.event_participant_id}
              booking={b}
              onCancel={handleCancelBooking}
            />
          ))}
        </div>
      )}

      {/* Admin: Benutzer-Tab */}
      {isAdmin() && activeTab === 'benutzer' && <UserManagementSection onJobsClick={handleUserJobsClick} initialEmailFilter={usersEmailFilter} />}

      {/* Admin: Jobs-Tab */}
      {isAdmin() && activeTab === 'jobs' && <AllJobsSection initialEmailFilter={jobsEmailFilter} onUserClick={handleJobUserClick} />}

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
    </div>
    </div>
  )
}
