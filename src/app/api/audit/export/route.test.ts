// src/app/api/audit/export/route.test.ts
import { NextRequest } from 'next/server'

vi.mock('@/lib/authz', () => ({ getCurrentAdmin: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { auditLog: { findMany: vi.fn() } } }))
vi.mock('@/lib/audit', () => ({ audit: vi.fn(), getClientIp: vi.fn(() => undefined), getUserAgent: vi.fn(() => undefined) }))

const { getCurrentAdmin } = await import('@/lib/authz')
const { prisma }          = await import('@/lib/prisma')
const { audit }           = await import('@/lib/audit')
const { GET }             = await import('./route')

const ADMIN = { id: 'a1', email: 'a@t.com', name: 'Admin', role: 'ADMIN' }
const req = (url = 'http://localhost/api/audit/export') => ({ url } as unknown as NextRequest)

beforeEach(() => vi.clearAllMocks())

describe('GET /api/audit/export', () => {
  it('401 sin sesión', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(null)
    expect((await GET(req())).status).toBe(401)
  })

  it('403 sin auditoria:ver (recepcionista) y no consulta la BD', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue({ ...ADMIN, role: 'RECEPCIONISTA' })
    expect((await GET(req())).status).toBe(403)
    expect(prisma.auditLog.findMany).not.toHaveBeenCalled()
  })

  it('200: CSV descargable con filas escapadas, y audita el EXPORT', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(ADMIN)
    vi.mocked(prisma.auditLog.findMany).mockResolvedValue([
      {
        createdAt: new Date('2026-01-02T03:04:05.000Z'), action: 'UPDATE', entity: 'APPOINTMENT',
        actorType: 'ADMIN', userEmail: 'a@t.com', ip: '1.2.3.4', description: 'Editó "Ana"', entityId: 'apt-1',
      },
    ] as never)

    const res = await GET(req())
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toMatch(/text\/csv/)
    expect(res.headers.get('Content-Disposition')).toMatch(/attachment; filename=/)

    const text = await res.text()
    expect(text).toContain('Fecha')                       // encabezado
    expect(text).toContain('apt-1')                       // fila
    expect(text).toContain('2026-01-02T03:04:05.000Z')
    expect(text).toContain('""Ana""')                     // comillas internas escapadas (RFC-4180)

    // Exportar es en sí un evento auditable.
    expect(audit).toHaveBeenCalled()
    expect(vi.mocked(audit).mock.calls[0][0].action).toBe('EXPORT')
  })
})
