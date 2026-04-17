import { useState, useEffect, useRef } from 'react'
import { getRecentCourses } from '../api/facilities'

interface Props {
  value: string
  onChange: (course: string) => void
  facilityCourses: string[]
}

export default function CourseCombobox({ value, onChange, facilityCourses }: Props) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [recentCourses, setRecentCourses] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const inFilterMode = isOpen && query.length >= 3
  const displayedResults = inFilterMode
    ? facilityCourses.filter(c => c.toLowerCase().includes(query.toLowerCase()))
    : recentCourses

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    getRecentCourses()
      .then(setRecentCourses)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isOpen])

  function handleSelect(course: string) {
    onChange(course)
    setQuery('')
    setIsOpen(false)
  }

  const inputClass = 'bg-surface-input text-white rounded-lg px-3 py-2 outline-hidden focus:ring-2 focus:ring-brand w-full'

  return (
    <div ref={containerRef} className="relative">
      <input
        aria-label="Kursname"
        type="text"
        value={isOpen ? query : value}
        placeholder={isOpen ? '' : (value || 'Kurs suchen…')}
        onFocus={() => { setIsOpen(true); setQuery('') }}
        onChange={e => {
          setQuery(e.target.value)
          onChange(e.target.value)
        }}
        required
        autoComplete="off"
        className={inputClass}
      />

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-surface-card rounded-lg shadow-lg overflow-hidden">
          {loading && (
            <div className="px-3 py-2 text-slate-400 text-sm">Laden…</div>
          )}
          {!loading && query.length > 0 && query.length < 3 && (
            <div className="px-3 py-2 text-slate-500 text-sm">
              Mindestens 3 Zeichen zum Filtern
            </div>
          )}
          {!loading && displayedResults.length === 0 && (query.length === 0 || query.length >= 3) && (
            <div className="px-3 py-2 text-slate-500 text-sm">Keine Ergebnisse</div>
          )}
          {!loading && displayedResults.map(course => (
            <button
              key={course}
              type="button"
              onClick={() => handleSelect(course)}
              className="w-full text-left px-3 py-2 text-white hover:bg-surface-input transition-colors text-sm"
            >
              {course}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
