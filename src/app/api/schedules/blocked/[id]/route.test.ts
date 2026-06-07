// src/app/api/schedules/blocked/[id]/route.test.ts
import { NextRequest } from 'next/server'
import { DELETE } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    blockedDate: { delete: vi.fn() },
  },
}))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')

const CTX = (id = 'bd-1') => ({ params: Promise.resolve({ id }) })

function makeRequest(): NextRequest {
  return {} as unknown as NextRequest
}

describe('DELETE /api/schedules/blocked/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await DELETE(makeRequest(), CTX())
    expect(res.status).toBe(401)
  })

  it('returns 404 when blocked date not found', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.blockedDate.delete).mockRejectedValue(new Error('Record not found'))

    const res = await DELETE(makeRequest(), CTX('missing'))
    expect(res.status).toBe(404)
  })

  it('deletes blocked date and returns id', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.blockedDate.delete).mockResolvedValue({ id: 'bd-1', date: new Date(), reason: null })

    const res  = await DELETE(makeRequest(), CTX())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.id).toBe('bd-1')
    expect(prisma.blockedDate.delete).toHaveBeenCalledWith({ where: { id: 'bd-1' } })
  })
})
