import { useState, useEffect, useRef } from 'react'
import { Input } from './ui'

interface Props {
  value: string
  onChange: (course: string) => void
  facilityCourses: string[]
  isLoading?: boolean
  canSearch?: boolean
}

export default function CourseCombobox({ value, onChange, facilityCourses, isLoading = false, canSearch = true }: Props) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const sorted = [...facilityCourses].sort((a, b) => a.localeCompare(b, 'de'))
  const displayedResults = query
    ? sorted.filter(c => c.toLowerCase().includes(query.toLowerCase()))
    : sorted

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleSelect(course: string) {
    onChange(course)
    setQuery('')
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        variant="inline"
        aria-label="Kursname"
        type="text"
        value={isOpen ? query : value}
        placeholder={isOpen ? '' : (value || 'Kurs auswählen…')}
        onFocus={() => { setIsOpen(true); setQuery('') }}
        onChange={e => {
          setQuery(e.target.value)
          onChange(e.target.value)
        }}
        required
        onKeyDown={e => {
          // Erstes Esc schließt nur die Vorschlagsliste, nicht den umgebenden Dialog.
          if (e.key === 'Escape' && isOpen) { e.preventDefault(); setIsOpen(false); setQuery('') }
        }}
        autoComplete="off"
      />

      {isOpen && (
        <div className="absolute z-10 mt-3 -mx-3.5 w-[calc(100%+1.75rem)] bg-surface-input border border-line rounded-xl shadow-[0_20px_50px_rgba(0,0,0,.45)] overflow-hidden max-h-60 overflow-y-auto">
          {displayedResults.length === 0 && (
            <div className="px-3 py-2 text-slate-500 text-sm">
              {!canSearch
                ? 'Anbieter, Wochentag oder Uhrzeit fehlt.'
                : isLoading
                  ? 'Kurse werden geladen…'
                  : 'Keine Kurse gefunden'}
            </div>
          )}
          {displayedResults.map(course => (
            <button
              key={course}
              type="button"
              onClick={() => handleSelect(course)}
              className="w-full text-left px-3.5 py-2.5 text-white hover:bg-surface-raised transition-colors text-sm"
            >
              {course}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
