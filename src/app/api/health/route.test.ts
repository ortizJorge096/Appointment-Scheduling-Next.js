import { NextRequest } from 'next/server'
import { GET } from './route'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $queryRaw: vi.fn(),
  },
}))

const { prisma } = await import('@/lib/prisma')

function makeRequest(search = ''): NextRequest {
  return {
    nextUrl: { searchParams: new URLSearchParams(search) },
  } as NextRequest
}

describe('GET /api/health', () => {
  beforeEach(() => vi.clearAllMocks())

  it('liveness: returns status ok without hitting DB', async () => {
    const res = await GET(makeRequest())
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.status).toBe('ok')
    expect(json).not.toHaveProperty('db')
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
  })

  it('readiness: returns ok when DB is reachable', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ '?column?': 1 }])
    const res = await GET(makeRequest('readiness'))
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.status).toBe('ok')
    expect(json.db).toBe('reachable')
  })

  it('readiness: returns 503 when DB is unreachable', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('Connection refused'))
    const res = await GET(makeRequest('readiness'))
    const json = await res.json()
    expect(res.status).toBe(503)
    expect(json.db).toBe('unreachable')
  })

  it('liveness: includes uptime and timestamp', async () => {
    const res = await GET(makeRequest())
    const json = await res.json()
    expect(typeof json.uptime).toBe('number')
    expect(typeof json.timestamp).toBe('string')
  })
})
