// src/app/api/schedules/blocked/route.test.ts
import { NextRequest } from 'next/server'
import { GET, POST } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    blockedDate: {
      findMany: vi.fn(),
      create:   vi.fn(),
    },
  },
}))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')

const MOCK_BLOCKED = {
  id:     'bd-1',
  date:   new Date('2026-12-25'),
  reason: 'Navidad',
}

function makeRequest(body?: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest
}

describe('GET /api/schedules/blocked', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns upcoming blocked dates (public)', async () => {
    vi.mocked(prisma.blockedDate.findMany).mockResolvedValue([MOCK_BLOCKED])

    const res  = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(1)
  })
})

describe('POST /api/schedules/blocked', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await POST(makeRequest({ date: '2026-12-25', reason: 'Navidad' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for malformed JSON', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    const req = { json: () => Promise.reject(new Error('bad json')) } as unknown as NextRequest
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid date format', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    const res = await POST(makeRequest({ date: '25/12/2026' }))
    expect(res.status).toBe(400)
  })

  it('creates blocked date and returns 201', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.blockedDate.create).mockResolvedValue(MOCK_BLOCKED)

    const res  = await POST(makeRequest({ date: '2026-12-25', reason: 'Navidad' }))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.success).toBe(true)
    expect(json.data.id).toBe('bd-1')
  })

  it('creates blocked date without reason (optional)', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.blockedDate.create).mockResolvedValue({ ...MOCK_BLOCKED, reason: null })

    const res  = await POST(makeRequest({ date: '2026-12-25' }))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.success).toBe(true)
  })
})
