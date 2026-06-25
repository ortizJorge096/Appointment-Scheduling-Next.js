// src/app/api/professionals/route.test.ts
import { NextRequest } from 'next/server'
import { GET } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: { professional: { findMany: vi.fn() } },
}))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')

function makeRequest(url = 'http://localhost/api/professionals'): NextRequest {
  return { url } as NextRequest
}

describe('GET /api/professionals', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.professional.findMany).mockResolvedValue([])
  })

  it('public (no session) only gets active professionals', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    await GET(makeRequest())
    expect(prisma.professional.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, isActive: true } })
    )
  })

  it('admin without the flag still gets active-only (booking flow must never leak inactive)', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    await GET(makeRequest())
    expect(prisma.professional.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, isActive: true } })
    )
  })

  it('admin with ?includeInactive=true gets all non-deleted professionals', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    await GET(makeRequest('http://localhost/api/professionals?includeInactive=true'))
    expect(prisma.professional.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null } })
    )
  })

  it('includeInactive without a session is ignored (stays active-only)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    await GET(makeRequest('http://localhost/api/professionals?includeInactive=true'))
    expect(prisma.professional.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, isActive: true } })
    )
  })
})
