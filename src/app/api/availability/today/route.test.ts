// src/app/api/availability/today/route.test.ts
import { Prisma } from '@prisma/client'

vi.mock('@/lib/availability', () => ({ getRemainingSlotsToday: vi.fn() }))
// Real @/lib/db-error → true DB-down classification.

const { getRemainingSlotsToday } = await import('@/lib/availability')
const { GET } = await import('./route')

beforeEach(() => vi.clearAllMocks())

describe('GET /api/availability/today', () => {
  it('200 con los cupos restantes', async () => {
    vi.mocked(getRemainingSlotsToday).mockResolvedValue(7 as never)
    const res = await GET()
    expect(res.status).toBe(200)
    expect((await res.json()).data).toEqual({ remaining: 7 })
  })

  it('503 cuando la BD está caída', async () => {
    vi.mocked(getRemainingSlotsToday).mockRejectedValue(new Prisma.PrismaClientInitializationError('down', '5.0.0'))
    expect((await GET()).status).toBe(503)
  })

  it('500 ante un error inesperado', async () => {
    vi.mocked(getRemainingSlotsToday).mockRejectedValue(new Error('boom'))
    expect((await GET()).status).toBe(500)
  })
})
