// src/lib/rate-limit.test.ts
import { rateLimit, rateLimitReset } from './rate-limit'

vi.mock('@/lib/prisma', () => ({
  prisma: { $queryRaw: vi.fn(), $executeRaw: vi.fn().mockResolvedValue(0) },
}))

const { prisma } = await import('@/lib/prisma')

beforeEach(() => {
  vi.clearAllMocks()
  // Keep the random cleanup from firing (and mutating call counts) in tests.
  vi.spyOn(Math, 'random').mockReturnValue(0.9)
})

describe('rateLimit', () => {
  it('allows while the count is under the limit', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ count: 3 }])
    const r = await rateLimit('booking:1.2.3.4', 5, 60_000)
    expect(r.ok).toBe(true)
    expect(r.remaining).toBe(2)
  })

  it('allows exactly at the limit', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ count: 5 }])
    expect((await rateLimit('k', 5, 60_000)).ok).toBe(true)
  })

  it('blocks once the count exceeds the limit', async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ count: 6 }])
    const r = await rateLimit('k', 5, 60_000)
    expect(r.ok).toBe(false)
    expect(r.remaining).toBe(0)
  })

  it('fails OPEN on a DB error (never blocks a legit request)', async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValue(new Error('db down'))
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = await rateLimit('k', 5, 60_000)
    expect(r.ok).toBe(true)
    spy.mockRestore()
  })
})

describe('rateLimitReset', () => {
  it('deletes the key and never throws', async () => {
    await expect(rateLimitReset('login:1.2.3.4')).resolves.toBeUndefined()
    expect(prisma.$executeRaw).toHaveBeenCalled()
  })
})
