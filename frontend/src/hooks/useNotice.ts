import { useState, useEffect } from 'react'

const cache = new Map<string, string>()

export function clearNoticeCache(): void {
  cache.clear()
}

export function useNotice(url: string | undefined): string | null {
  const [content, setContent] = useState<string | null>(() => {
    if (!url) return null
    const cached = cache.get(url)
    return cached !== undefined ? (cached || null) : null
  })

  useEffect(() => {
    if (!url) return
    if (cache.has(url)) {
      setContent(cache.get(url) || null)
      return
    }
    fetch(url)
      .then(r => r.text())
      .then(text => {
        const trimmed = text.trim()
        cache.set(url, trimmed)
        setContent(trimmed || null)
      })
      .catch(() => {
        setContent(null)
      })
  }, [url])

  return content
}
