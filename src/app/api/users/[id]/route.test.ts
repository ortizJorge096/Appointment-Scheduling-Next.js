// src/app/api/users/[id]/route.test.ts
import { NextRequest } from 'next/server'

vi.mock('@/lib/authz', () => ({ requireSuperAdmin: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user:     { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn(), count: vi.fn() },
    auditLog: { count: vi.fn() },
  },
}))
vi.mock('@/lib/audit', () => ({ audit: vi.fn(), getClientIp: vi.fn(() => undefined) }))
vi.mock('@/lib/db-error', () => ({ isDbUnavailable: vi.fn(() => false), dbUnavailableResponse: vi.fn() }))

const { requireSuperAdmin } = await import('@/lib/authz')
const { prisma }            = await import('@/lib/prisma')
const { PATCH }             = await import('./route')

const ME = { id: 'me', email: 'super@test.com', name: 'Super', role: 'SUPER_ADMIN' as const }

function req(body: unknown, id: string) {
  return [
    { json: () => Promise.resolve(body) } as unknown as NextRequest,
    { params: Promise.resolve({ id }) },
  ] as const
}

beforeEach(() => vi.clearAllMocks())

describe('PATCH /api/users/[id] guard rails', () => {
  it('403 when the caller is not a SUPER_ADMIN', async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue(null)
    const res = await PATCH(...req({ name: 'X' }, 'other'))
    expect(res.status).toBe(403)
  })

  it('rejects deactivating yourself', async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue(ME)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'me', name: 'Super', email: 'super@test.com', role: 'SUPER_ADMIN', isActive: true } as never)
    const res = await PATCH(...req({ isActive: false }, 'me'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/desactivarte/i)
  })

  it('rejects deactivating the last active SUPER_ADMIN', async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue(ME)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'other', name: 'Other', email: 'o@test.com', role: 'SUPER_ADMIN', isActive: true } as never)
    vi.mocked(prisma.user.count).mockResolvedValue(1) // only one active super admin
    const res = await PATCH(...req({ isActive: false }, 'other'))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/SUPER_ADMIN activo/i)
  })

  it('updates an admin successfully', async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue(ME)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'other', name: 'Other', email: 'o@test.com', role: 'ADMIN', isActive: true } as never)
    vi.mocked(prisma.user.update).mockResolvedValue({ id: 'other', name: 'Renamed', email: 'o@test.com', role: 'ADMIN', isActive: true, lastLoginAt: null, createdAt: new Date() } as never)
    const res = await PATCH(...req({ name: 'Renamed' }, 'other'))
    expect(res.status).toBe(200)
    expect((await res.json()).data.name).toBe('Renamed')
  })
})
