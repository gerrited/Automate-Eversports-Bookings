import { useState, useEffect } from 'react'
import { getEmail } from '../api/client'

export default function Footer() {
  const sha = import.meta.env.VITE_COMMIT_SHA as string | undefined
  const repo = import.meta.env.VITE_GITHUB_REPO as string | undefined
  const version = import.meta.env.VITE_VERSION as string | undefined
  const [email, setEmail] = useState<string | null>(getEmail)

  useEffect(() => {
    const handler = () => setEmail(getEmail())
    window.addEventListener('auth-changed', handler)
    return () => window.removeEventListener('auth-changed', handler)
  }, [])

  if (!sha && !email && !version) return null

  const shortSha = sha?.slice(0, 7)
  const commitHref = sha && repo ? `https://github.com/${repo}/commit/${sha}` : undefined
  const versionHref = version && repo ? `https://github.com/${repo}/releases/tag/v${version}` : undefined

  return (
    <footer style={{ position: 'fixed', bottom: 0, left: 0, right: 0, textAlign: 'center', padding: '6px', fontSize: '0.7rem', color: '#9ca3af', background: '#021214', borderTop: '1px solid #0d3538', display: 'flex', justifyContent: 'center', gap: '8px' }}>
      {email && <span>Angemeldet als {email} -</span>}
      {version && (
        <span>
          {versionHref ? (
            <a href={versionHref} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
              v{version}
            </a>
          ) : `v${version}`}
        </span>
      )}
      {version && shortSha && <span>·</span>}
      {shortSha && (
        <span>
          {commitHref ? (
            <a href={commitHref} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
              {shortSha}
            </a>
          ) : shortSha}
        </span>
      )}
    </footer>
  )
}
