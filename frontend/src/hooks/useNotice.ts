import { useState, useEffect } from 'react'

const cache = new Map<string, string | null>()

export function clearNoticeCache(): void {
  cache.clear()
}

export function useNotice(url: string | undefined): string | null {
  const [content, setContent] = useState<string | null>(() => {
    if (!url) return null
    return cache.has(url) ? cache.get(url)! : null
  })

  useEffect(() => {
    if (!url) return
    if (cache.has(url)) {
      setContent(cache.get(url)!)
      return
    }
    fetch(url)
      .then(r => r.text())
      .then(text => {
        const value = text.trim() || null
        cache.set(url, value)
        setContent(value)
      })
      .catch(() => {
        cache.set(url, null)
        setContent(null)
      })
  }, [url])

  return content
}
