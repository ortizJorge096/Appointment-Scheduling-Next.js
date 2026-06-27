import { render, screen } from '@testing-library/react'
import Footer from './Footer'

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

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
  INSTAGRAM_URL: 'https://instagram.com/_valebeautystudio_',
  TIKTOK_URL: 'https://tiktok.com/valebeautystudio1',
}))

// FooterServiceLinks fetches the live category list.
const MOCK_CATEGORIES = [
  { id: 'c1', name: 'Uñas',             slug: 'UNAS'     },
  { id: 'c2', name: 'Pestañas',         slug: 'PESTANAS' },
  { id: 'c3', name: 'Cejas',            slug: 'CEJAS'    },
  { id: 'c4', name: 'Corte de Cabello', slug: 'CORTE'    },
  { id: 'c5', name: 'Promos',           slug: 'PROMOS'   },
]

describe('Footer', () => {
  beforeEach(() => {
    globalThis.fetch = vi.fn(() =>
      Promise.resolve({ json: () => Promise.resolve({ success: true, data: MOCK_CATEGORIES }) })
    ) as unknown as typeof fetch
    render(<Footer />)
  })

  it('renders studio name and tagline', () => {
    expect(screen.getByText('VJ')).toBeInTheDocument()
    expect(screen.getByText('Studio')).toBeInTheDocument()
  })

  it('renders navigation links', () => {
    // "Servicios" appears twice: the services column and the nav column
    expect(screen.getAllByText('Servicios').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Galería')).toBeInTheDocument()
    expect(screen.getByText('Agendar cita')).toBeInTheDocument()
  })

  it('renders the services column', async () => {
    expect(await screen.findByText('Uñas')).toBeInTheDocument()
    expect(screen.getByText('Pestañas')).toBeInTheDocument()
    expect(screen.getByText('Cejas')).toBeInTheDocument()
    expect(screen.getByText('Corte de Cabello')).toBeInTheDocument()
    expect(screen.getByText('Promos')).toBeInTheDocument()
  })

  it('builds the tagline from service categories and excludes Promos', async () => {
    const tagline = await screen.findByText(
      (_, el) =>
        el?.tagName === 'P' &&
        (el.textContent ?? '').includes('Uñas, pestañas, cejas y corte de cabello en Bogotá')
    )
    expect(tagline).toBeInTheDocument()
    expect(tagline.textContent).not.toMatch(/promos/i)
  })

  it('links each service category to its booking deep-link', async () => {
    expect((await screen.findByText('Uñas')).closest('a')).toHaveAttribute('href', '/agendar?categoria=UNAS')
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

  it('renders Instagram link', () => {
    const ig = screen.getByText('Instagram')
    expect(ig.closest('a')).toHaveAttribute('href', 'https://instagram.com/_valebeautystudio_')
  })

  it('renders TikTok link', () => {
    const tt = screen.getByText('TikTok')
    expect(tt.closest('a')).toHaveAttribute('href', 'https://tiktok.com/valebeautystudio1')
  })
})