import { useState, useEffect } from 'react'

interface Loaded {
  url: string
  content: string | null
}

export function useNotice(url: string | undefined): string | null {
  const [loaded, setLoaded] = useState<Loaded | null>(null)

  useEffect(() => {
    if (!url) return
    let cancelled = false
    fetch(url, { cache: 'no-store' })
      .then(r => r.text())
      .then(text => { if (!cancelled) setLoaded({ url, content: text.trim() || null }) })
      .catch(() => { if (!cancelled) setLoaded({ url, content: null }) })
    return () => { cancelled = true }
  }, [url])

  // Inhalt einer früheren URL nie anzeigen – solange die aktuelle lädt, gibt es keinen.
  return url && loaded?.url === url ? loaded.content : null
}
