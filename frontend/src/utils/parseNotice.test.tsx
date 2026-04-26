import { render } from '@testing-library/react'
import { parseNotice } from './parseNotice'

function renderNotice(text: string) {
  const { container } = render(<span>{parseNotice(text)}</span>)
  return container
}

describe('parseNotice', () => {
  it('gibt einfachen Text unverändert zurück', () => {
    expect(renderNotice('Hello world').textContent).toBe('Hello world')
  })

  it('wandelt **fett** in strong um', () => {
    const container = renderNotice('Hello **world**')
    expect(container.querySelector('strong')?.textContent).toBe('world')
  })

  it('wandelt [text](url) in a mit target _blank um', () => {
    const container = renderNotice('[klick](https://example.com)')
    const a = container.querySelector('a')
    expect(a?.textContent).toBe('klick')
    expect(a?.getAttribute('href')).toBe('https://example.com')
    expect(a?.getAttribute('target')).toBe('_blank')
    expect(a?.getAttribute('rel')).toBe('noopener noreferrer')
  })

  it('verarbeitet gemischten Inhalt mit Emoji', () => {
    const container = renderNotice('🎉 **Neu**: [Details](https://example.com)')
    expect(container.textContent).toBe('🎉 Neu: Details')
    expect(container.querySelector('strong')?.textContent).toBe('Neu')
    expect(container.querySelector('a')?.getAttribute('href')).toBe('https://example.com')
  })

  it('verarbeitet mehrere Links', () => {
    const container = renderNotice('[A](https://a.com) und [B](https://b.com)')
    const links = container.querySelectorAll('a')
    expect(links).toHaveLength(2)
    expect(links[0].textContent).toBe('A')
    expect(links[1].textContent).toBe('B')
  })
})
