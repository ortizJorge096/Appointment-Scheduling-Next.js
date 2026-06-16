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
  it('renders one card per specialty (category labels)', async () => {
    render(await ServicesGrid())
    expect(screen.getByText('Uñas')).toBeInTheDocument()
    expect(screen.getByText('Pestañas')).toBeInTheDocument()
  })

  it('each specialty card links to the booking flow filtered by category', async () => {
    render(await ServicesGrid())
    const links = screen.getAllByRole('link', { name: /reservar/i })
    expect(links.length).toBe(2)
    expect(links[0]).toHaveAttribute('href', '/agendar?categoria=UNAS')
    expect(links[1]).toHaveAttribute('href', '/agendar?categoria=PESTANAS')
  })

  it('shows the "desde" minimum price for each category', async () => {
    render(await ServicesGrid())
    // Both categories render a "desde <min price>" line
    expect(screen.getAllByText(/desde/i).length).toBe(2)
    expect(screen.getAllByText(/35/).length).toBeGreaterThan(0)
  })

  it('does NOT render the full service listing', async () => {
    render(await ServicesGrid())
    expect(screen.queryByText('Manicura tradicional')).not.toBeInTheDocument()
  })
})
