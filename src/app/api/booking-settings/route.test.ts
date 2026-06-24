// src/app/api/booking-settings/route.test.ts
import { NextRequest } from 'next/server'
import { GET, PUT } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    bookingSettings: {
      findFirst: vi.fn(),
      update:    vi.fn(),
      create:    vi.fn(),
    },
  },
}))
vi.mock('@/lib/audit', () => ({
  audit:        vi.fn(),
  getClientIp:  vi.fn(),
  getUserAgent: vi.fn(),
}))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')
const { audit }            = await import('@/lib/audit')

const ROW = { id: 'bs1', showProfessionalStep: true, maxAdvanceDays: 90 }

function makeRequest(body?: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest
}

describe('GET /api/booking-settings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns settings including maxAdvanceDays', async () => {
    vi.mocked(prisma.bookingSettings.findFirst).mockResolvedValue(ROW)

    const res  = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.maxAdvanceDays).toBe(90)
    expect(json.data.showProfessionalStep).toBe(true)
  })

  it('falls back to defaults when no row exists', async () => {
    vi.mocked(prisma.bookingSettings.findFirst).mockResolvedValue(null)

    const json = await (await GET()).json()
    expect(json.data.maxAdvanceDays).toBe(90)
    expect(json.data.showProfessionalStep).toBe(true)
  })
})

describe('PUT /api/booking-settings', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await PUT(makeRequest({ maxAdvanceDays: 120 }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for an out-of-range maxAdvanceDays', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    const res = await PUT(makeRequest({ maxAdvanceDays: 500 }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for an empty body (nothing to update)', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    const res = await PUT(makeRequest({}))
    expect(res.status).toBe(400)
  })

  it('updates only maxAdvanceDays (partial) and audits a readable description', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.bookingSettings.findFirst).mockResolvedValue(ROW)
    vi.mocked(prisma.bookingSettings.update).mockResolvedValue({ ...ROW, maxAdvanceDays: 120 })

    const res  = await PUT(makeRequest({ maxAdvanceDays: 120 }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    // Partial update: only the sent field is persisted (showProfessionalStep untouched)
    expect(prisma.bookingSettings.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { maxAdvanceDays: 120 } })
    )

    const entry = vi.mocked(audit).mock.calls[0][0]
    expect(entry.description).toMatch(/120 días/)
  })
})
