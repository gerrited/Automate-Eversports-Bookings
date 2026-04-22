import { render, screen, fireEvent } from '@testing-library/react'
import HelpIcon from './HelpIcon'

describe('HelpIcon', () => {
  it('renders the ? button', () => {
    render(<HelpIcon text="Hilfetext hier" />)
    expect(screen.getByRole('button', { name: /hilfe anzeigen/i })).toBeInTheDocument()
  })

  it('popup is hidden by default', () => {
    render(<HelpIcon text="Hilfetext hier" />)
    expect(screen.queryByText('Hilfetext hier')).not.toBeInTheDocument()
  })

  it('shows popup on button click', () => {
    render(<HelpIcon text="Hilfetext hier" />)
    fireEvent.click(screen.getByRole('button', { name: /hilfe anzeigen/i }))
    expect(screen.getByText('Hilfetext hier')).toBeInTheDocument()
  })

  it('hides popup on second button click', () => {
    render(<HelpIcon text="Hilfetext hier" />)
    fireEvent.click(screen.getByRole('button', { name: /hilfe anzeigen/i }))
    fireEvent.click(screen.getByRole('button', { name: /hilfe anzeigen/i }))
    expect(screen.queryByText('Hilfetext hier')).not.toBeInTheDocument()
  })

  it('closes popup when clicking outside', () => {
    render(
      <div>
        <HelpIcon text="Hilfetext hier" />
        <div data-testid="outside">Außen</div>
      </div>
    )
    fireEvent.click(screen.getByRole('button', { name: /hilfe anzeigen/i }))
    expect(screen.getByText('Hilfetext hier')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByTestId('outside'))
    expect(screen.queryByText('Hilfetext hier')).not.toBeInTheDocument()
  })
})
