// src/app/api/users/route.test.ts
import { NextRequest } from 'next/server'

vi.mock('@/lib/authz', () => ({ requireSuperAdmin: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn() } } }))
vi.mock('bcryptjs', () => ({ default: { hash: vi.fn() } }))
vi.mock('@/lib/audit', () => ({ audit: vi.fn(), getClientIp: vi.fn(() => undefined) }))
vi.mock('@/lib/db-error', () => ({ isDbUnavailable: vi.fn(() => false), dbUnavailableResponse: vi.fn() }))

const { requireSuperAdmin } = await import('@/lib/authz')
const { prisma }           = await import('@/lib/prisma')
const bcrypt               = (await import('bcryptjs')).default
const { audit }            = await import('@/lib/audit')
const { GET, POST }        = await import('./route')

const SUPER = { id: 'me', email: 'super@test.com', name: 'Super', role: 'SUPER_ADMIN' as const }
// Email intentionally mixed-case to prove the route normalizes it.
const VALID = { name: 'Nuevo Admin', email: 'Nuevo@Test.com', password: 'StrongP1', role: 'ADMIN' }

const req = (body: unknown) => ({ json: () => Promise.resolve(body) } as unknown as NextRequest)

beforeEach(() => vi.clearAllMocks())

describe('GET /api/users', () => {
  it('403 si el llamante no es SUPER_ADMIN (y no consulta la BD)', async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue(null)
    const res = await GET()
    expect(res.status).toBe(403)
    expect(prisma.user.findMany).not.toHaveBeenCalled()
  })

  it('200 y pide a Prisma un select SIN password', async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue(SUPER)
    vi.mocked(prisma.user.findMany).mockResolvedValue(
      [{ id: 'u1', name: 'A', email: 'a@t.com', role: 'ADMIN', isActive: true, lastLoginAt: null, createdAt: new Date() }] as never,
    )
    const res = await GET()
    expect(res.status).toBe(200)
    const selectArg = vi.mocked(prisma.user.findMany).mock.calls[0][0].select
    expect(selectArg).not.toHaveProperty('password')
    expect(selectArg).toMatchObject({ id: true, email: true, role: true })
  })
})

describe('POST /api/users', () => {
  it('403 y NO crea cuando el llamante no es SUPER_ADMIN', async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue(null)
    const res = await POST(req(VALID))
    expect(res.status).toBe(403)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('400 cuando la contraseña no cumple la política', async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue(SUPER)
    const res = await POST(req({ ...VALID, password: 'weak' }))
    expect(res.status).toBe(400)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('409 y NO crea cuando el email ya existe', async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue(SUPER)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'existing' } as never)
    const res = await POST(req(VALID))
    expect(res.status).toBe(409)
    expect(prisma.user.create).not.toHaveBeenCalled()
  })

  it('201: normaliza email, hashea, fuerza cambio de contraseña, audita y no filtra el hash', async () => {
    vi.mocked(requireSuperAdmin).mockResolvedValue(SUPER)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null as never)
    vi.mocked(bcrypt.hash).mockResolvedValue('hash-nuevo' as never)
    vi.mocked(prisma.user.create).mockResolvedValue(
      { id: 'new', name: 'Nuevo Admin', email: 'nuevo@test.com', role: 'ADMIN', isActive: true, lastLoginAt: null, createdAt: new Date() } as never,
    )

    const res = await POST(req(VALID))
    expect(res.status).toBe(201)
    expect(bcrypt.hash).toHaveBeenCalledWith('StrongP1', 12)

    // Email normalizado a minúsculas, tanto en el lookup como en la creación.
    expect(vi.mocked(prisma.user.findUnique).mock.calls[0][0]).toMatchObject({ where: { email: 'nuevo@test.com' } })
    const createArg = vi.mocked(prisma.user.create).mock.calls[0][0]
    expect(createArg.data).toMatchObject({ email: 'nuevo@test.com', password: 'hash-nuevo', role: 'ADMIN', mustChangePassword: true })
    expect(createArg.select).not.toHaveProperty('password')
    expect(audit).toHaveBeenCalled()
    expect((await res.json()).data).not.toHaveProperty('password')
  })
})
