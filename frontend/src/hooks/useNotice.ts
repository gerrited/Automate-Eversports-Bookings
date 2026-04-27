import { useState, useEffect } from 'react'

export function useNotice(url: string | undefined): string | null {
  const [content, setContent] = useState<string | null>(null)

  useEffect(() => {
    setContent(null)
    if (!url) return
    fetch(url, { cache: 'no-store' })
      .then(r => r.text())
      .then(text => setContent(text.trim() || null))
      .catch(() => setContent(null))
  }, [url])

  return content
}
