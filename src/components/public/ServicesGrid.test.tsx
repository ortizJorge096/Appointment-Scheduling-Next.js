import { render, screen, waitFor } from '@testing-library/react'
import ServicesGrid from './ServicesGrid'

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

const MOCK_SERVICES = [
  { id: 'svc-1', name: 'Manicura tradicional', description: 'Limado y esmaltado', categoryId: 'cat-unas',     price: 35000, durationMinutes: 45, order: 1, isActive: true },
  { id: 'svc-2', name: 'Lifting de pestañas',  description: null,                  categoryId: 'cat-pestanas', price: 80000, durationMinutes: 60, order: 2, isActive: true },
]

const MOCK_CATEGORIES = [
  { id: 'cat-unas',     name: 'Uñas',     slug: 'UNAS',     description: 'Manicura y más', icon: 'manicura', order: 1 },
  { id: 'cat-pestanas', name: 'Pestañas', slug: 'PESTANAS', description: 'Lifting y más',   icon: 'pestanas', order: 2 },
]

function setupApiMocks() {
  globalThis.fetch = vi.fn((url: string) => {
    const u = typeof url === 'string' ? url : ''
    const data = u === '/api/categories' ? MOCK_CATEGORIES : MOCK_SERVICES
    return Promise.resolve({ json: () => Promise.resolve({ success: true, data }) })
  }) as unknown as typeof fetch
}

beforeEach(() => {
  setupApiMocks()
})

describe('ServicesGrid', () => {
  it('renders one category card per category with active services', async () => {
    render(<ServicesGrid />)
    expect(await screen.findByText('Uñas')).toBeInTheDocument()
    expect(screen.getByText('Pestañas')).toBeInTheDocument()
    // Plus the static VIP promo card
    expect(screen.getByText('Paquete VIP')).toBeInTheDocument()
  })

  it('each category card links to the booking flow filtered by category', async () => {
    render(<ServicesGrid />)
    await screen.findByText('Uñas')
    const links = screen.getAllByRole('link', { name: /reservar/i })
    expect(links.find((l) => l.getAttribute('href') === '/agendar?categoria=UNAS')).toBeTruthy()
    expect(links.find((l) => l.getAttribute('href') === '/agendar?categoria=PESTANAS')).toBeTruthy()
  })

  it('shows the lowest price and duration range for each category', async () => {
    render(<ServicesGrid />)
    await waitFor(() => {
      expect(screen.getByText(/35\.000/)).toBeInTheDocument()
      expect(screen.getByText('45 min')).toBeInTheDocument()
      expect(screen.getByText(/80\.000/)).toBeInTheDocument()
      expect(screen.getByText('60 min')).toBeInTheDocument()
    })
  })
})
