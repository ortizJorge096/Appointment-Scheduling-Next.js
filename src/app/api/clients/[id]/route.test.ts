// src/app/api/clients/[id]/route.test.ts
import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth',   () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    client: {
      findUnique: vi.fn(),
      update:     vi.fn(),
      delete:     vi.fn(),
    },
    auditLog: { create: vi.fn() },
  },
}))
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

beforeEach(() => { vi.clearAllMocks() })

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
