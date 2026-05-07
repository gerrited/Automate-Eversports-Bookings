import { useState, useEffect, useRef } from 'react'
import { Input } from './ui'

interface Props {
  value: string
  onChange: (course: string) => void
  facilityCourses: string[]
}

export default function CourseCombobox({ value, onChange, facilityCourses }: Props) {
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
      />

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-surface-card rounded-lg shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {displayedResults.length === 0 && (
            <div className="px-3 py-2 text-slate-500 text-sm">Keine Kurse gefunden</div>
          )}
          {displayedResults.map(course => (
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
