import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import Logo from './Logo'

describe('Logo', () => {
  it('rendert das Logo-Bild', () => {
    render(<Logo />)
    expect(screen.getByRole('img', { name: 'Logo' })).toBeInTheDocument()
  })

  it('App-Logo (gehasht) und E-Mail-Logo (public/logo.png) sind identisch', () => {
    // Die App nutzt src/assets/logo.png (Cache-Busting per Hash), die E-Mail-Templates
    // verlinken {frontend_url}/logo.png. Bei einem Logo-Wechsel beide Dateien ersetzen.
    const root = resolve(__dirname, '../..')
    const app = readFileSync(resolve(root, 'src/assets/logo.png'))
    const mail = readFileSync(resolve(root, 'public/logo.png'))
    expect(app.equals(mail)).toBe(true)
  })
})
