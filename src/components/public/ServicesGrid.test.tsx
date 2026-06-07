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
        { id: 'svc-1', name: 'Manicura tradicional', description: 'Limado y esmaltado', category: 'UNAS',     price: 35000, durationMinutes: 45, order: 1, isActive: true },
        { id: 'svc-2', name: 'Lifting de pestañas',  description: null,                  category: 'PESTANAS', price: 80000, durationMinutes: 60, order: 2, isActive: true },
      ]),
    },
  },
}))

vi.mock('@/lib/config', () => ({
  CATEGORY_ORDER: ['UNAS', 'PESTANAS'],
  categoryLabel: (k: string) => ({ UNAS: 'Uñas', PESTANAS: 'Pestañas' }[k] ?? k),
}))

describe('ServicesGrid', () => {
  it('renders service names', async () => {
    render(await ServicesGrid())
    expect(screen.getByText('Manicura tradicional')).toBeInTheDocument()
    expect(screen.getByText('Lifting de pestañas')).toBeInTheDocument()
  })

  it('renders Reservar buttons linking to /agendar', async () => {
    render(await ServicesGrid())
    const links = screen.getAllByRole('link', { name: /reservar/i })
    expect(links.length).toBe(2)
    expect(links[0]).toHaveAttribute('href', '/agendar?service=svc-1')
    expect(links[1]).toHaveAttribute('href', '/agendar?service=svc-2')
  })

  it('entire card is NOT a link', async () => {
    render(await ServicesGrid())
    // Solo los botones Reservar deben ser links, no las tarjetas
    const allLinks = screen.getAllByRole('link')
    const reservarLinks = allLinks.filter((l) => l.textContent?.includes('Reservar'))
    expect(reservarLinks.length).toBe(allLinks.filter(l => l.getAttribute('href')?.startsWith('/agendar?service=')).length)
  })

  it('shows price and duration', async () => {
    render(await ServicesGrid())
    expect(screen.getByText(/35/)).toBeInTheDocument()
    expect(screen.getByText(/45 min/)).toBeInTheDocument()
  })
})
