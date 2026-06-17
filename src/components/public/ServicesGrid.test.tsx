import { render, screen } from '@testing-library/react'
import ServicesGrid from './ServicesGrid'

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    service: {
      findMany: vi.fn().mockResolvedValue([
        { id: 'svc-1', name: 'Manicura tradicional', description: 'Limado y esmaltado', category: 'MANICURA', price: 35000, durationMinutes: 45, order: 1, isActive: true },
        { id: 'svc-2', name: 'Lifting de pestañas',  description: null,                  category: 'CEJAS_PESTANAS', price: 80000, durationMinutes: 60, order: 2, isActive: true },
      ]),
    },
  },
}))

describe('ServicesGrid', () => {
  it('renders one card per individual service', async () => {
    render(await ServicesGrid())
    expect(screen.getByText('Manicura tradicional')).toBeInTheDocument()
    expect(screen.getByText('Lifting de pestañas')).toBeInTheDocument()
  })

  it('each service card links to the booking flow filtered by service ID', async () => {
    render(await ServicesGrid())
    const links = screen.getAllByRole('link', { name: /reservar/i })
    expect(links.length).toBe(2)
    expect(links[0]).toHaveAttribute('href', '/agendar?service=svc-1')
    expect(links[1]).toHaveAttribute('href', '/agendar?service=svc-2')
  })

  it('shows price and duration for each service', async () => {
    render(await ServicesGrid())
    expect(screen.getAllByText(/35\.000/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/45 min/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/80\.000/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/60 min/).length).toBeGreaterThan(0)
  })
})
