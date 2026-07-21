// src/app/api/clients/[id]/route.test.ts
import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth',   () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => {
  // Defined inside the factory (vi.mock is hoisted) and reused as the transaction
  // client, so assertions on prisma.client.update still see the calls the route
  // makes through `tx`.
  const client      = { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() }
  const appointment = { updateMany: vi.fn() }
  return {
    prisma: {
      client,
      appointment,
      auditLog: { create: vi.fn() },
      $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({ client, appointment })),
    },
  }
})
vi.mock('@/lib/db-error', () => ({
  isDbUnavailable:      vi.fn().mockReturnValue(false),
  dbUnavailableResponse: vi.fn(),
}))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')
const { GET, PATCH, DELETE } = await import('./route')

const MOCK_SESSION = { user: { id: 'a1', email: 'admin@test.com', role: 'SUPER_ADMIN' } }
const MOCK_CLIENT = {
  id: 'c1', name: 'Ana López', email: 'ana@test.com',
  phone: '3001234567', notes: 'Alérgica al acrílico',
  createdAt: new Date(), updatedAt: new Date(),
  appointments: [], _count: { appointments: 0 },
}

const ctx = { params: Promise.resolve({ id: 'c1' }) }

beforeEach(() => {
  vi.clearAllMocks()
  // The route reads `.count` off the result, so it must always resolve to an object.
  vi.mocked(prisma.appointment.updateMany).mockResolvedValue({ count: 0 } as never)
})

function makePatchRequest(body: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest
}

describe('GET /api/clients/:id', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await GET({} as NextRequest, ctx)
    expect(res.status).toBe(401)
  })

  it('returns 404 when client does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.client.findUnique).mockResolvedValue(null)

    const res = await GET({} as NextRequest, ctx)
    expect(res.status).toBe(404)
  })

  it('returns client with appointment history', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.client.findUnique).mockResolvedValue(MOCK_CLIENT as never)

    const res = await GET({} as NextRequest, ctx)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.name).toBe('Ana López')
  })
})

describe('PATCH /api/clients/:id', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await PATCH(makePatchRequest({}), ctx)
    expect(res.status).toBe(401)
  })

  it('returns 400 on invalid body', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    const res = await PATCH(makePatchRequest({ email: 'not-valid' }), ctx)
    expect(res.status).toBe(400)
  })

  it('updates client notes', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.client.update).mockResolvedValue({
      ...MOCK_CLIENT, notes: 'Alérgica al acrílico y al gel',
    } as never)

    const res = await PATCH(makePatchRequest({ notes: 'Alérgica al acrílico y al gel' }), ctx)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
  })

  it('syncs a renamed client onto their appointments (denormalized snapshot)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.client.findUnique).mockResolvedValue({
      name: 'Ana López', email: 'ana@test.com', phone: '3001234567', notes: 'Alérgica al acrílico',
    } as never)
    vi.mocked(prisma.client.update).mockResolvedValue({ ...MOCK_CLIENT, name: 'Ana Lopez Ruiz' } as never)
    vi.mocked(prisma.appointment.updateMany).mockResolvedValue({ count: 3 } as never)

    const res = await PATCH(makePatchRequest({ name: 'Ana Lopez Ruiz' }), ctx)
    expect(res.status).toBe(200)

    // The citas list renders (and the admin search indexes) the denormalized
    // clientName, so it has to follow the rename. Only the changed field is synced.
    expect(prisma.appointment.updateMany).toHaveBeenCalledWith({
      where: { clientId: 'c1' },
      data:  { clientName: 'Ana Lopez Ruiz' },
    })
  })

  it('leaves appointments alone when the contact data did not change', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.client.findUnique).mockResolvedValue({
      name: 'Ana López', email: 'ana@test.com', phone: '3001234567', notes: 'Alérgica al acrílico',
    } as never)
    vi.mocked(prisma.client.update).mockResolvedValue({ ...MOCK_CLIENT, notes: 'nueva nota' } as never)

    await PATCH(makePatchRequest({ notes: 'nueva nota' }), ctx)
    expect(prisma.appointment.updateMany).not.toHaveBeenCalled()
  })

  it('returns 404 when client not found (P2025)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.client.update).mockRejectedValue({ code: 'P2025' })

    const res = await PATCH(makePatchRequest({ notes: 'algo' }), ctx)
    expect(res.status).toBe(404)
  })

  it('archives a client (sets deletedAt) when archived=true', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.client.update).mockResolvedValue({ ...MOCK_CLIENT, deletedAt: new Date() } as never)

    const res = await PATCH(makePatchRequest({ archived: true }), ctx)
    expect(res.status).toBe(200)

    const updateArg = vi.mocked(prisma.client.update).mock.calls[0][0] as { data: { deletedAt: Date | null } }
    expect(updateArg.data.deletedAt).toBeInstanceOf(Date)
  })

  it('reactivates a client (clears deletedAt) when archived=false', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.client.update).mockResolvedValue({ ...MOCK_CLIENT, deletedAt: null } as never)

    const res = await PATCH(makePatchRequest({ archived: false }), ctx)
    expect(res.status).toBe(200)

    const updateArg = vi.mocked(prisma.client.update).mock.calls[0][0] as { data: { deletedAt: Date | null } }
    expect(updateArg.data.deletedAt).toBeNull()
  })
})

describe('DELETE /api/clients/:id', () => {
  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await DELETE({} as NextRequest, ctx)
    expect(res.status).toBe(401)
  })

  it('returns 404 when client does not exist', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.client.findUnique).mockResolvedValue(null)

    const res = await DELETE({} as NextRequest, ctx)
    expect(res.status).toBe(404)
    expect(prisma.client.delete).not.toHaveBeenCalled()
  })

  it('returns 409 when the client has appointments (must archive instead)', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.client.findUnique).mockResolvedValue({ name: 'Ana López', _count: { appointments: 2 } } as never)

    const res = await DELETE({} as NextRequest, ctx)
    expect(res.status).toBe(409)
    expect(prisma.client.delete).not.toHaveBeenCalled()
  })

  it('hard-deletes a client with no appointments', async () => {
    vi.mocked(getServerSession).mockResolvedValue(MOCK_SESSION)
    vi.mocked(prisma.client.findUnique).mockResolvedValue({ name: 'Ana López', _count: { appointments: 0 } } as never)
    vi.mocked(prisma.client.delete).mockResolvedValue({ id: 'c1' } as never)

    const res = await DELETE({} as NextRequest, ctx)
    const json = await res.json()
    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prisma.client.delete).toHaveBeenCalledWith({ where: { id: 'c1' } })
  })
})
