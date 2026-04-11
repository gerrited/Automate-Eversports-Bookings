import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { clearToken } from '../api/client'
import { listJobs, createJob, updateJob, toggleJob, deleteJob, getJobLogs } from '../api/jobs'
import type { Job, BookingLog, JobFormData } from '../types'
import JobCard from '../components/JobCard'
import JobModal from '../components/JobModal'
import LogDrawer from '../components/LogDrawer'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [editingJob, setEditingJob] = useState<Job | 'new' | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [logs, setLogs] = useState<BookingLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)

  const loadJobs = useCallback(async () => {
    try {
      setJobs(await listJobs())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadJobs() }, [loadJobs])

  function handleLogout() {
    clearToken()
    navigate('/login')
  }

  async function handleSave(data: JobFormData) {
    if (editingJob === 'new' || editingJob === null) {
      await createJob(data)
    } else {
      await updateJob(editingJob.id, data)
    }
    setShowModal(false)
    setEditingJob(null)
    loadJobs()
  }

  async function handleToggle(id: string) {
    await toggleJob(id)
    loadJobs()
  }

  async function handleDelete(id: string) {
    if (!window.confirm('Job wirklich löschen?')) return
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

  return (
    <div className="min-h-screen bg-surface-page">
    <div className="px-4 py-8 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Logo" className="h-8 w-auto" />
          <h1 className="text-white text-xl font-bold">E̶v̶e̶r̶ALWAYSsports Buchungen</h1>
        </div>
        <button
          onClick={handleLogout}
          className="px-3 py-1 rounded-md bg-slate-700 hover:bg-slate-600 text-slate-200 text-sm transition-colors"
        >
          Logout
        </button>
      </div>

      {/* Add button */}
      <button
        onClick={() => { setEditingJob('new'); setShowModal(true) }}
        className="w-full mb-6 py-3 bg-brand hover:bg-brand-hover text-white font-semibold rounded-xl transition-colors"
      >
        + Buchung hinzufügen
      </button>

      {/* Job list */}
      {loading && <p className="text-slate-400 text-sm">Lädt…</p>}
      {!loading && jobs.length === 0 && (
        <p className="text-slate-400 text-sm text-center mt-12">
          Noch keine Jobs. Leg einen an!
        </p>
      )}
      <div className="flex flex-col gap-3">
        {jobs.map(job => (
          <JobCard
            key={job.id}
            job={job}
            onToggle={handleToggle}
            onEdit={j => { setEditingJob(j); setShowModal(true) }}
            onDelete={handleDelete}
            onSelect={handleSelect}
          />
        ))}
      </div>

      {/* Modal */}
      {showModal && (
        <JobModal
          job={editingJob !== 'new' && editingJob !== null ? editingJob : undefined}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditingJob(null) }}
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
    </div>
    </div>
  )
}
