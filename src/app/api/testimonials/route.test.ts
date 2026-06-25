// src/app/api/testimonials/route.test.ts
import { NextRequest } from 'next/server'
import { GET } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: { testimonial: { findMany: vi.fn() } },
}))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')

const PUBLIC_WHERE = { deletedAt: null, isActive: true, status: 'APPROVED' }

function getReq(url = 'http://localhost/api/testimonials'): NextRequest {
  return { url } as NextRequest
}

describe('GET /api/testimonials', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.testimonial.findMany).mockResolvedValue([])
  })

  it('public (no session) gets only approved + active testimonials', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    await GET(getReq())
    expect(prisma.testimonial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: PUBLIC_WHERE })
    )
  })

  it('admin on the landing (no manage flag) still gets the public-safe set', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    await GET(getReq())
    expect(prisma.testimonial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: PUBLIC_WHERE })
    )
  })

  it('admin with ?manage=true gets all non-deleted testimonials', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    await GET(getReq('http://localhost/api/testimonials?manage=true'))
    expect(prisma.testimonial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } })
    )
  })

  it('admin management view honors status/active filters', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    await GET(getReq('http://localhost/api/testimonials?manage=true&status=PENDING&active=false'))
    expect(prisma.testimonial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, status: 'PENDING', isActive: false } })
    )
  })

  it('manage=true without a session is ignored (stays public-safe)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    await GET(getReq('http://localhost/api/testimonials?manage=true'))
    expect(prisma.testimonial.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: PUBLIC_WHERE })
    )
  })
})
