// frontend/src/components/NoticeBanner.tsx
import { useRef, useEffect } from 'react'
import { useNotice } from '../hooks/useNotice'
import { parseNotice } from '../utils/parseNotice'

interface Props {
  url: string | undefined
  topOffset?: string
  cssVar?: string
}

export default function NoticeBanner({ url, topOffset = '0px', cssVar = '--notice-height' }: Props) {
  const content = useNotice(url)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    document.documentElement.style.setProperty(cssVar, `${el.offsetHeight}px`)
    const observer = new ResizeObserver(() => {
      document.documentElement.style.setProperty(cssVar, `${el.offsetHeight}px`)
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      document.documentElement.style.setProperty(cssVar, '0px')
    }
  }, [cssVar])

  if (!content) return null

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        top: topOffset,
        left: 0,
        right: 0,
        zIndex: 30,
        background: '#021214',
        borderBottom: '1px solid #0d3538',
        padding: '6px',
        textAlign: 'center',
        fontSize: '0.7rem',
        color: '#9ca3af',
      }}
    >
      {parseNotice(content)}
    </div>
  )
}
