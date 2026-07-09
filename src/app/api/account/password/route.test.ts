// src/app/api/account/password/route.test.ts
import { NextRequest } from 'next/server'

vi.mock('@/lib/authz', () => ({ getCurrentAdmin: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: vi.fn(), update: vi.fn() } } }))
vi.mock('bcryptjs', () => ({ default: { compare: vi.fn(), hash: vi.fn() } }))
vi.mock('@/lib/audit', () => ({ audit: vi.fn(), getClientIp: vi.fn(() => undefined) }))
vi.mock('@/lib/db-error', () => ({ isDbUnavailable: vi.fn(() => false), dbUnavailableResponse: vi.fn() }))

const { getCurrentAdmin } = await import('@/lib/authz')
const { prisma }          = await import('@/lib/prisma')
const bcrypt              = (await import('bcryptjs')).default
const { audit }           = await import('@/lib/audit')
const { POST }            = await import('./route')

const ME = { id: 'me', email: 'me@test.com', name: 'Yo', role: 'ADMIN' as const }
// Meets strongPassword: >=8, one uppercase, one digit; confirm matches.
const VALID = { currentPassword: 'oldpass', newPassword: 'NewPass1', confirmPassword: 'NewPass1' }

const req = (body: unknown) => ({ json: () => Promise.resolve(body) } as unknown as NextRequest)

beforeEach(() => vi.clearAllMocks())

describe('POST /api/account/password', () => {
  it('401 sin sesión (y no toca la BD)', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(null)
    const res = await POST(req(VALID))
    expect(res.status).toBe(401)
    expect(prisma.user.findUnique).not.toHaveBeenCalled()
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('400 cuando la nueva contraseña no cumple la política', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(ME)
    const res = await POST(req({ currentPassword: 'x', newPassword: 'weak', confirmPassword: 'weak' }))
    expect(res.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('400 cuando newPassword y confirmPassword no coinciden', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(ME)
    const res = await POST(req({ currentPassword: 'x', newPassword: 'NewPass1', confirmPassword: 'Otra1234' }))
    expect(res.status).toBe(400)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('400 y NO actualiza cuando la contraseña actual es incorrecta', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(ME)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ password: 'hash-viejo' } as never)
    vi.mocked(bcrypt.compare).mockResolvedValue(false as never)
    const res = await POST(req(VALID))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/actual es incorrecta/i)
    expect(prisma.user.update).not.toHaveBeenCalled()
  })

  it('200: re-hashea, limpia mustChangePassword, marca passwordChangedAt y audita', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(ME)
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ password: 'hash-viejo' } as never)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
    vi.mocked(bcrypt.hash).mockResolvedValue('hash-nuevo' as never)
    vi.mocked(prisma.user.update).mockResolvedValue({} as never)

    const res = await POST(req(VALID))
    expect(res.status).toBe(200)
    expect(bcrypt.hash).toHaveBeenCalledWith('NewPass1', 12)

    const updateArg = vi.mocked(prisma.user.update).mock.calls[0][0]
    expect(updateArg.where).toEqual({ id: 'me' })
    expect(updateArg.data).toMatchObject({ password: 'hash-nuevo', mustChangePassword: false })
    expect(updateArg.data.passwordChangedAt).toBeInstanceOf(Date)
    expect(audit).toHaveBeenCalled()
  })
})
