// src/app/api/audit/route.test.ts
import { NextRequest } from 'next/server'
import { Prisma } from '@prisma/client'

vi.mock('@/lib/authz', () => ({ getCurrentAdmin: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { auditLog: { findMany: vi.fn(), count: vi.fn() } } }))
// Real @/lib/permissions + @/lib/db-error → true permission gate + true DB-down detection.

const { getCurrentAdmin } = await import('@/lib/authz')
const { prisma }          = await import('@/lib/prisma')
const { GET }             = await import('./route')

const ADMIN = { id: 'a1', email: 'a@t.com', name: 'Admin', role: 'ADMIN' }
const req = (url = 'http://localhost/api/audit') => ({ url } as unknown as NextRequest)

beforeEach(() => vi.clearAllMocks())

describe('GET /api/audit', () => {
  it('401 sin sesión', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(null)
    expect((await GET(req())).status).toBe(401)
  })

  it('403 cuando el rol no tiene auditoria:ver (recepcionista)', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue({ ...ADMIN, role: 'RECEPCIONISTA' })
    const res = await GET(req())
    expect(res.status).toBe(403)
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled()
  })

  it('200 con paginación para un rol autorizado', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(ADMIN)
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([{ id: 'l1' }] as never)
    vi.mocked(prisma.auditLog.count).mockResolvedValue(1 as never)
    const res = await GET(req('http://localhost/api/audit?page=1&limit=50'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.logs).toHaveLength(1)
    expect(body.data.pagination).toMatchObject({ total: 1, page: 1, limit: 50, totalPages: 1 })
  })

  it('503 (Retry-After) cuando la BD está caída', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(ADMIN)
    const dbDown = new Prisma.PrismaClientInitializationError('cannot reach db', '5.0.0')
    vi.mocked(prisma.auditLog.findMany).mockRejectedValue(dbDown)
    vi.mocked(prisma.auditLog.count).mockRejectedValue(dbDown)
    const res = await GET(req())
    expect(res.status).toBe(503)
    expect(res.headers.get('Retry-After')).toBe('60')
  })
})
