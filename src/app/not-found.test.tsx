// src/app/not-found.test.tsx
import { render, screen } from '@testing-library/react'
import NotFound from './not-found'

vi.mock('@/components/public/Navbar', () => ({ default: () => <nav data-testid="navbar" /> }))
vi.mock('@/components/public/Footer', () => ({ default: () => <footer data-testid="footer" /> }))

describe('NotFound page', () => {
  it('renders 404 heading and navigation links', () => {
    render(<NotFound />)

    expect(screen.getByText('404')).toBeInTheDocument()
    expect(screen.getByText('Página no encontrada')).toBeInTheDocument()
  })

  it('renders Navbar and Footer', () => {
    render(<NotFound />)
    expect(screen.getByTestId('navbar')).toBeInTheDocument()
    expect(screen.getByTestId('footer')).toBeInTheDocument()
  })

  it('renders link back to home', () => {
    render(<NotFound />)
    const homeLink = screen.getByRole('link', { name: /volver al inicio/i })
    expect(homeLink).toHaveAttribute('href', '/')
  })

  it('renders link to schedule appointment', () => {
    render(<NotFound />)
    const agendarLink = screen.getByRole('link', { name: /agendar cita/i })
    expect(agendarLink).toHaveAttribute('href', '/agendar')
  })
})
