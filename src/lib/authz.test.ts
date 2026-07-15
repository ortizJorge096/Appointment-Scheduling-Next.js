// src/lib/authz.test.ts
// Server-side authorization gate. Mocks only the session source (getServerSession)
// so the REAL permission matrix runs — this exercises authz + permissions together.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getServerSession } from 'next-auth'
import { getCurrentAdmin, requirePermission, requireSuperAdmin } from './authz'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
// Avoid loading the real NextAuth config (it pulls prisma/bcrypt/etc).
vi.mock('@/lib/auth', () => ({ authOptions: {} }))

function session(user: Record<string, unknown> | null) {
  vi.mocked(getServerSession).mockResolvedValue((user ? { user } : null) as never)
}

beforeEach(() => vi.clearAllMocks())

describe('getCurrentAdmin', () => {
  it('null cuando no hay sesión', async () => {
    session(null)
    expect(await getCurrentAdmin()).toBeNull()
  })

  it('null si la sesión no trae id o role (cuenta desactivada / token viejo)', async () => {
    session({ email: 'a@t.com', name: 'Ana' }) // sin id ni role
    expect(await getCurrentAdmin()).toBeNull()
    session({ id: 'u1', name: 'Ana' })          // sin role
    expect(await getCurrentAdmin()).toBeNull()
  })

  it('mapea el admin desde la sesión', async () => {
    session({ id: 'u1', email: 'a@t.com', name: 'Ana', role: 'ADMIN' })
    expect(await getCurrentAdmin()).toEqual({ id: 'u1', email: 'a@t.com', name: 'Ana', role: 'ADMIN' })
  })

  it('normaliza email/name ausentes a ""', async () => {
    session({ id: 'u1', role: 'SUPER_ADMIN' })
    expect(await getCurrentAdmin()).toEqual({ id: 'u1', email: '', name: '', role: 'SUPER_ADMIN' })
  })
})

describe('requirePermission', () => {
  it('null sin sesión', async () => {
    session(null)
    expect(await requirePermission('citas:ver')).toBeNull()
  })

  it('devuelve el admin cuando el rol SÍ tiene el permiso', async () => {
    session({ id: 'u1', role: 'RECEPCIONISTA' })
    expect(await requirePermission('citas:crear')).toMatchObject({ id: 'u1', role: 'RECEPCIONISTA' })
  })

  it('null cuando el rol NO tiene el permiso (autorización negativa)', async () => {
    session({ id: 'u1', role: 'RECEPCIONISTA' })
    expect(await requirePermission('citas:pago')).toBeNull()
    expect(await requirePermission('admins:gestionar')).toBeNull()
  })
})

describe('requireSuperAdmin', () => {
  it('solo pasa SUPER_ADMIN', async () => {
    session({ id: 'u1', role: 'SUPER_ADMIN' })
    expect(await requireSuperAdmin()).not.toBeNull()

    session({ id: 'u2', role: 'ADMIN' })
    expect(await requireSuperAdmin()).toBeNull()

    session({ id: 'u3', role: 'RECEPCIONISTA' })
    expect(await requireSuperAdmin()).toBeNull()
  })
})
