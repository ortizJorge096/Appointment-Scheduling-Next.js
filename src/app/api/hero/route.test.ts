// src/app/api/hero/route.test.ts
import { NextRequest } from 'next/server'
import { GET, POST } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: { heroImage: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() } },
}))
vi.mock('@/lib/s3', () => ({ getPublicUrl: vi.fn((key: string) => `https://cdn.example.com/${key}`) }))
vi.mock('@/lib/audit', () => ({ audit: vi.fn(), getClientIp: vi.fn(() => '127.0.0.1') }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')
const { revalidatePath }   = await import('next/cache')

const ACTIVE_HERO   = { id: 'h1', s3Key: 'hero/h1.jpg', order: 1, isActive: true,  focalPoint: 'center center', createdAt: new Date() }
const INACTIVE_HERO = { id: 'h2', s3Key: 'hero/h2.jpg', order: 2, isActive: false, focalPoint: 'top center',    createdAt: new Date() }

function makeRequest(body?: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest
}
function getReq(url = 'http://localhost/api/hero'): NextRequest {
  return { url } as unknown as NextRequest
}

describe('GET /api/hero', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns only active images to the public', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    vi.mocked(prisma.heroImage.findMany).mockResolvedValue([ACTIVE_HERO])

    const json = await (await GET(getReq())).json()
    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(1)
    expect(prisma.heroImage.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { isActive: true } }))
  })

  it('returns all (including hidden) to admin with ?includeInactive=true', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.heroImage.findMany).mockResolvedValue([ACTIVE_HERO, INACTIVE_HERO])

    const json = await (await GET(getReq('http://localhost/api/hero?includeInactive=true'))).json()
    expect(json.data).toHaveLength(2)
    expect(prisma.heroImage.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }))
  })

  it('exposes url always but s3Key only to admin', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    vi.mocked(prisma.heroImage.findMany).mockResolvedValue([ACTIVE_HERO])
    const pub = await (await GET(getReq())).json()
    expect(pub.data[0].url).toContain('h1.jpg')
    expect(pub.data[0].s3Key).toBeUndefined()

    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.heroImage.findMany).mockResolvedValue([ACTIVE_HERO])
    const adm = await (await GET(getReq())).json()
    expect(adm.data[0].s3Key).toBe('hero/h1.jpg')
    expect(adm.data[0].focalPoint).toBe('center center')
  })
})

describe('POST /api/hero', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    expect((await POST(makeRequest({ s3Key: 'hero/x.jpg' }))).status).toBe(401)
  })

  it('returns 400 for an empty s3Key', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    expect((await POST(makeRequest({ s3Key: '' }))).status).toBe(400)
  })

  it('creates the image at the next order and refreshes the landing', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.heroImage.findFirst).mockResolvedValue({ order: 4 })
    vi.mocked(prisma.heroImage.create).mockResolvedValue(ACTIVE_HERO)

    const res  = await POST(makeRequest({ s3Key: 'hero/new.jpg' }))
    const json = await res.json()
    expect(res.status).toBe(201)
    expect(json.data.url).toContain('h1.jpg')
    expect(vi.mocked(prisma.heroImage.create).mock.calls[0][0].data.order).toBe(5) // max + 1
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })
})
