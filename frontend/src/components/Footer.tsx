import { getEmail } from '../api/client'

export default function Footer() {
  const sha = import.meta.env.VITE_COMMIT_SHA as string | undefined
  const repo = import.meta.env.VITE_GITHUB_REPO as string | undefined
  const email = getEmail()

  if (!sha && !email) return null

  const shortSha = sha?.slice(0, 7)
  const href = sha && repo ? `https://github.com/${repo}/commit/${sha}` : undefined

  return (
    <footer style={{ textAlign: 'center', padding: '8px', fontSize: '0.7rem', color: '#9ca3af', display: 'flex', justifyContent: 'center', gap: '12px' }}>
      {email && <span>Angemeldet als {email}</span>}
      {shortSha && (
        href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
            {shortSha}
          </a>
        ) : (
          <span>{shortSha}</span>
        )
      )}
    </footer>
  )
}
