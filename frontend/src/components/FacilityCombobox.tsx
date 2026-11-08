import { useState, useEffect, useRef } from 'react'
import type { Facility } from '../types'
import { getRecentFacilities, searchFacilities } from '../api/facilities'
import { Input } from './ui'

interface Props {
  value: Facility | null
  onChange: (facility: Facility) => void
}

export default function FacilityCombobox({ value, onChange }: Props) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [recentFacilities, setRecentFacilities] = useState<Facility[]>([])
  const [searchResults, setSearchResults] = useState<Facility[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const inSearchMode = isOpen && query.length >= 5
  const displayedResults = inSearchMode ? searchResults : recentFacilities

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Load recent facilities once when dropdown opens
  useEffect(() => {
    if (!isOpen) return
    setError(null)
    getRecentFacilities()
      .then(setRecentFacilities)
      .catch(() => setError('Fehler beim Laden'))
  }, [isOpen])

  // Debounced search when query reaches 5+ chars
  useEffect(() => {
    if (!inSearchMode) return
    setLoading(true)
    setError(null)
    const timer = setTimeout(() => {
      searchFacilities(query)
        .then(setSearchResults)
        .catch(() => setError('Suche fehlgeschlagen'))
        .finally(() => setLoading(false))
    }, 300)
    return () => clearTimeout(timer)
  }, [query, inSearchMode])

  function handleSelect(facility: Facility) {
    onChange(facility)
    setQuery('')
    setIsOpen(false)
  }

  return (
    <div ref={containerRef} className="relative">
      <Input
        variant="inline"
        aria-label="Anbieter suchen"
        type="text"
        value={isOpen ? query : (value?.name ?? '')}
        placeholder={value ? value.name : 'Anbieter suchen…'}
        onFocus={() => { setIsOpen(true); setQuery('') }}
        onChange={e => setQuery(e.target.value)}
        autoComplete="off"
      />

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-surface-card rounded-lg shadow-lg overflow-hidden">
          {loading && (
            <div className="px-3 py-2 text-slate-400 text-sm">Laden…</div>
          )}
          {error && (
            <div className="px-3 py-2 text-red-400 text-sm">{error}</div>
          )}
          {!loading && !error && query.length > 0 && query.length < 5 && (
            <div className="px-3 py-2 text-slate-500 text-sm">
              Mindestens 5 Zeichen für Suche
            </div>
          )}
          {!loading && !error && displayedResults.length === 0 && (query.length === 0 || query.length >= 5) && (
            <div className="px-3 py-2 text-slate-500 text-sm">Keine Ergebnisse</div>
          )}
          {!loading && !error && displayedResults.map(facility => (
            <button
              key={facility.id}
              type="button"
              onClick={() => handleSelect(facility)}
              className="w-full text-left px-3 py-2 text-white hover:bg-surface-input transition-colors text-sm"
            >
              {facility.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
