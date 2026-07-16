// src/app/api/testimonials/[id]/route.test.ts
import { NextRequest } from 'next/server'

vi.mock('@/lib/authz', () => ({ getCurrentAdmin: vi.fn() }))
// hasPermission is mocked so we can assert the route asks for the RIGHT permission
// per action (moderar vs editar) — the interesting security branch here.
vi.mock('@/lib/permissions', () => ({ hasPermission: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { testimonial: { findUnique: vi.fn(), update: vi.fn() } } }))
vi.mock('@/lib/audit', () => ({ audit: vi.fn(), getClientIp: vi.fn(() => undefined) }))
vi.mock('@/lib/s3', () => ({ deleteObject: vi.fn() }))

const { getCurrentAdmin } = await import('@/lib/authz')
const { hasPermission }   = await import('@/lib/permissions')
const { prisma }          = await import('@/lib/prisma')
const { audit }           = await import('@/lib/audit')
const { PATCH, DELETE }   = await import('./route')

const ADMIN = { id: 'a1', email: 'a@t.com', name: 'Admin', role: 'ADMIN' }

function call(body: unknown, id = 't1') {
  return [
    { json: () => Promise.resolve(body) } as unknown as NextRequest,
    { params: Promise.resolve({ id }) },
  ] as const
}

beforeEach(() => vi.clearAllMocks())

describe('PATCH /api/testimonials/[id]', () => {
  it('401 sin sesión', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(null)
    const res = await PATCH(...call({ status: 'APPROVED' }))
    expect(res.status).toBe(401)
  })

  it('400 con body inválido (texto demasiado corto)', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(ADMIN)
    const res = await PATCH(...call({ text: 'x' }))
    expect(res.status).toBe(400)
  })

  it('aprobar exige testimonios:moderar (403 sin el permiso)', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(ADMIN)
    vi.mocked(hasPermission).mockReturnValue(false)
    const res = await PATCH(...call({ status: 'APPROVED' }))
    expect(res.status).toBe(403)
    expect(hasPermission).toHaveBeenCalledWith('ADMIN', 'testimonios:moderar')
  })

  it('una edición simple exige testimonios:editar (403 sin el permiso)', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(ADMIN)
    vi.mocked(hasPermission).mockReturnValue(false)
    const res = await PATCH(...call({ text: 'Un testimonio bien majo' }))
    expect(res.status).toBe(403)
    expect(hasPermission).toHaveBeenCalledWith('ADMIN', 'testimonios:editar')
  })

  it('404 cuando el testimonio no existe', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(ADMIN)
    vi.mocked(hasPermission).mockReturnValue(true)
    vi.mocked(prisma.testimonial.findUnique).mockResolvedValue(null as never)
    const res = await PATCH(...call({ status: 'APPROVED' }))
    expect(res.status).toBe(404)
    expect(prisma.testimonial.update).not.toHaveBeenCalled()
  })

  it('200 al aprobar: actualiza y audita como STATUS_CHANGE', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(ADMIN)
    vi.mocked(hasPermission).mockReturnValue(true)
    vi.mocked(prisma.testimonial.findUnique).mockResolvedValue(
      { clientName: 'Ana', type: 'Cliente', text: 'Genial', stars: 5, imageUrl: null, imageKey: null, isActive: true, status: 'PENDING', order: 0 } as never,
    )
    vi.mocked(prisma.testimonial.update).mockResolvedValue({ id: 't1', status: 'APPROVED' } as never)
    const res = await PATCH(...call({ status: 'APPROVED' }))
    expect(res.status).toBe(200)
    expect(prisma.testimonial.update).toHaveBeenCalled()
    expect(vi.mocked(audit).mock.calls[0][0].action).toBe('STATUS_CHANGE')
  })
})

describe('DELETE /api/testimonials/[id]', () => {
  it('401 sin sesión', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(null)
    const res = await DELETE(...call({}))
    expect(res.status).toBe(401)
  })

  it('403 sin testimonios:editar', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(ADMIN)
    vi.mocked(hasPermission).mockReturnValue(false)
    const res = await DELETE(...call({}))
    expect(res.status).toBe(403)
    expect(prisma.testimonial.update).not.toHaveBeenCalled()
  })

  it('200: soft-delete (deletedAt + isActive false) y audita DELETE', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(ADMIN)
    vi.mocked(hasPermission).mockReturnValue(true)
    vi.mocked(prisma.testimonial.findUnique).mockResolvedValue({ clientName: 'Ana' } as never)
    vi.mocked(prisma.testimonial.update).mockResolvedValue({} as never)
    const res = await DELETE(...call({}))
    expect(res.status).toBe(200)
    const updateArg = vi.mocked(prisma.testimonial.update).mock.calls[0][0]
    expect(updateArg.data).toMatchObject({ isActive: false })
    expect(updateArg.data.deletedAt).toBeInstanceOf(Date)
    expect(vi.mocked(audit).mock.calls[0][0].action).toBe('DELETE')
  })
})
