// src/app/api/professionals/[id]/route.test.ts
import { NextRequest } from 'next/server'
import { PATCH, DELETE } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    professional: {
      findUnique: vi.fn(),
      update:     vi.fn(),
      delete:     vi.fn(),
    },
    appointment: {
      count: vi.fn(),
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

const BEFORE = { name: 'Valentina Jiménez', specialty: 'Especialista master', rating: 4.9, reviewCount: 130, isActive: true, order: 1 }
const CTX = (id = 'pro-1') => ({ params: Promise.resolve({ id }) })

function makeRequest(body?: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as NextRequest
}

describe('PATCH /api/professionals/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ isActive: false }), CTX())
    expect(res.status).toBe(401)
  })

  it('returns 404 when the professional does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.professional.findUnique).mockResolvedValue(null)

    const res = await PATCH(makeRequest({ isActive: false }), CTX('missing'))
    expect(res.status).toBe(404)
  })

  it('disables a professional and audits a readable description with a diff', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.professional.findUnique).mockResolvedValue(BEFORE)
    vi.mocked(prisma.professional.update).mockResolvedValue({ id: 'pro-1', isActive: false })

    const res = await PATCH(makeRequest({ isActive: false }), CTX())
    expect(res.status).toBe(200)

    const entry = vi.mocked(audit).mock.calls[0][0]
    expect(entry.entity).toBe('PROFESSIONAL')
    expect(entry.description).toMatch(/Valentina Jiménez/)
    expect(entry.description).toMatch(/desactivado/)
    expect(entry.description).not.toMatch(/pro-1/)
    expect(entry.before).toBeDefined()
    expect(entry.after).toBeDefined()
  })
})

describe('DELETE /api/professionals/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await DELETE(makeRequest(), CTX())
    expect(res.status).toBe(401)
  })

  it('blocks deletion (409) when there are upcoming appointments', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.professional.findUnique).mockResolvedValue({ name: 'Valentina Jiménez' })
    vi.mocked(prisma.appointment.count).mockResolvedValue(1)

    const res = await DELETE(makeRequest(), CTX())
    expect(res.status).toBe(409)
    expect(prisma.professional.update).not.toHaveBeenCalled()
    expect(prisma.professional.delete).not.toHaveBeenCalled()
  })

  it('soft-deletes (never hard-deletes) and audits a readable description (no id)', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.professional.findUnique).mockResolvedValue({ name: 'Valentina Jiménez' })
    vi.mocked(prisma.appointment.count).mockResolvedValue(0)
    vi.mocked(prisma.professional.update).mockResolvedValue({ id: 'pro-1' })

    const res = await DELETE(makeRequest(), CTX())
    expect(res.status).toBe(200)

    // Soft delete: keeps the row (no hard delete), sets isActive=false + deletedAt
    expect(prisma.professional.delete).not.toHaveBeenCalled()
    expect(prisma.professional.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: false }) })
    )

    const entry = vi.mocked(audit).mock.calls[0][0]
    expect(entry.action).toBe('DELETE')
    expect(entry.description).toMatch(/Valentina Jiménez/)
    expect(entry.description).not.toMatch(/pro-1/)
  })
})
