import { render, screen } from '@testing-library/react'
import Footer from './Footer'

vi.mock('@/lib/config', () => ({
  STUDIO: {
    shortName: 'VJ',
    tagline: 'Studio',
    name: 'Valentina Jimenez',
    city: 'Bogotá',
    address: 'Calle 123',
    phone: '+57 300 123 4567',
    email: 'hola@valentinajimenez.com',
  },
  WHATSAPP_URL: 'https://wa.me/573001234567',
  MAILTO_URL: 'mailto:hola@valentinajimenez.com',
  INSTAGRAM_URL: 'https://instagram.com/test', 
}))

describe('Footer', () => {
  beforeEach(() => {
    render(<Footer />)
  })

  it('renders studio name and tagline', () => {
    expect(screen.getByText('VJ')).toBeInTheDocument()
    expect(screen.getByText('Studio')).toBeInTheDocument()
  })

  it('renders navigation links', () => {
    expect(screen.getByText('Servicios')).toBeInTheDocument()
    expect(screen.getByText('Galería')).toBeInTheDocument()
    expect(screen.getByText('Agendar cita')).toBeInTheDocument()
  })

  it('renders contact info', () => {
    expect(screen.getByText('Calle 123')).toBeInTheDocument()
    expect(screen.getByText('+57 300 123 4567')).toBeInTheDocument()
    expect(screen.getByText('hola@valentinajimenez.com')).toBeInTheDocument()
  })

  it('renders copyright with current year', () => {
    const year = new Date().getFullYear().toString()
    expect(screen.getByText(new RegExp(year))).toBeInTheDocument()
  })

  it('renders WhatsApp link', () => {
    const wa = screen.getByText('+57 300 123 4567')
    expect(wa.closest('a')).toHaveAttribute('href', 'https://wa.me/573001234567')
  })
})
