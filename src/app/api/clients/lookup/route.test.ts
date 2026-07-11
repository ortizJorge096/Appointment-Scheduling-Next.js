// src/app/api/clients/lookup/route.test.ts
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: { client: { findUnique: vi.fn() } },
}))
vi.mock('@/lib/db-error', () => ({
  isDbUnavailable:      vi.fn().mockReturnValue(false),
  dbUnavailableResponse: vi.fn(),
}))

const { prisma } = await import('@/lib/prisma')
const { GET }    = await import('./route')

function req(phone?: string): NextRequest {
  const url = new URL('http://localhost/api/clients/lookup')
  if (phone !== undefined) url.searchParams.set('phone', phone)
  return { url: url.toString(), headers: new Headers() } as unknown as NextRequest
}

beforeEach(() => { vi.clearAllMocks() })

describe('GET /api/clients/lookup', () => {
  it('returns found:false for a too-short phone without hitting the DB', async () => {
    const res  = await GET(req('123'))
    const json = await res.json()
    expect(json).toEqual({ success: true, data: { found: false } })
    expect(prisma.client.findUnique).not.toHaveBeenCalled()
  })

  it('returns found:true and the name for a known phone, keyed by normalized phone', async () => {
    vi.mocked(prisma.client.findUnique).mockResolvedValue({ name: 'Ana Pérez' } as never)
    const res  = await GET(req('3001112233'))
    const json = await res.json()
    expect(json.data).toEqual({ found: true, name: 'Ana Pérez' })
    // 10-digit local number → normalized to 57 + digits
    expect(vi.mocked(prisma.client.findUnique).mock.calls[0][0]).toMatchObject({
      where: { phoneNormalized: '573001112233' },
    })
  })

  it('returns found:false for an unknown phone', async () => {
    vi.mocked(prisma.client.findUnique).mockResolvedValue(null as never)
    const res  = await GET(req('3009998877'))
    const json = await res.json()
    expect(json.data).toEqual({ found: false, name: null })
  })

  it('discloses only the name — never email or other PII', async () => {
    vi.mocked(prisma.client.findUnique).mockResolvedValue({ name: 'Ana' } as never)
    const res  = await GET(req('3001112233'))
    const json = await res.json()
    expect(json.data).not.toHaveProperty('email')
    expect(vi.mocked(prisma.client.findUnique).mock.calls[0][0]).toMatchObject({
      select: { name: true },
    })
  })
})
