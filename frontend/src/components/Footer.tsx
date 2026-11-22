import { useState } from 'react'
import FaqModal from './FaqModal'
import ImprintModal from './ImprintModal'
import Logo from './Logo'

interface Props {
  /** Logo links anzeigen (Landing Page). */
  withLogo?: boolean
}

const LINK = 'text-muted hover:text-white transition-colors'

export default function Footer({ withLogo = false }: Props) {
  const sha = import.meta.env.VITE_COMMIT_SHA as string | undefined
  const repo = import.meta.env.VITE_GITHUB_REPO as string | undefined
  const version = (import.meta.env.VITE_VERSION as string | undefined)?.replace(/^v/, '')
  const [faqOpen, setFaqOpen] = useState(false)
  const [imprintOpen, setImprintOpen] = useState(false)

  const shortSha = sha?.slice(0, 7)
  const commitHref = sha && repo ? `https://github.com/${repo}/commit/${sha}` : undefined
  const versionHref = version && repo ? `https://github.com/${repo}/releases/tag/v${version}` : undefined

  return (
    <>
      <footer className="border-t border-line-subtle px-5 pt-6 pb-[calc(1.75rem+env(safe-area-inset-bottom))]">
        <div
          className={`max-w-[1152px] mx-auto flex flex-wrap items-center gap-4 ${withLogo ? 'justify-center sm:justify-between' : 'justify-center'}`}
        >
          {withLogo && <Logo size="sm" />}
          <div className="flex flex-wrap items-center justify-center gap-2.5 text-sm text-muted">
            <button type="button" aria-label="Impressum & Datenschutz" onClick={() => setImprintOpen(true)} className={LINK}>
              Impressum & Datenschutz
            </button>
            <span aria-hidden="true">·</span>
            <button type="button" aria-label="FAQ" onClick={() => setFaqOpen(true)} className={LINK}>
              FAQ
            </button>
            {(version || shortSha) && <span aria-hidden="true">·</span>}
            {version && (
              <span>
                {versionHref ? (
                  <a href={versionHref} target="_blank" rel="noopener noreferrer" className={LINK}>
                    v{version}
                  </a>
                ) : `v${version}`}
              </span>
            )}
            {shortSha && (
              <span>
                {version && '('}
                {commitHref ? (
                  <a href={commitHref} target="_blank" rel="noopener noreferrer" className={LINK}>
                    {shortSha}
                  </a>
                ) : shortSha}
                {version && ')'}
              </span>
            )}
          </div>
        </div>
      </footer>
      {faqOpen && <FaqModal onClose={() => setFaqOpen(false)} />}
      {imprintOpen && <ImprintModal onClose={() => setImprintOpen(false)} />}
    </>
  )
}
