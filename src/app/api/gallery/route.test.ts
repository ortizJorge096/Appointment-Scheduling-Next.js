// src/app/api/gallery/route.test.ts
import { NextRequest } from 'next/server'
import { GET, POST } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    galleryImage: {
      findMany:  vi.fn(),
      findFirst: vi.fn(),
      create:    vi.fn(),
    },
  },
}))
vi.mock('@/lib/s3', () => ({
  getPublicUrl: vi.fn((key: string) => `https://cdn.example.com/${key}`),
}))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')

const ACTIVE_IMAGE   = { id: 'img-1', s3Key: 'gallery/img-1.jpg', title: 'Test', description: null, category: null, width: 800, height: 600, order: 1, isActive: true,  createdAt: new Date() }
const INACTIVE_IMAGE = { id: 'img-2', s3Key: 'gallery/img-2.jpg', title: null,   description: null, category: null, width: 800, height: 600, order: 2, isActive: false, createdAt: new Date() }

function makeRequest(body?: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest
}
function getReq(url = 'http://localhost/api/gallery'): NextRequest {
  return { url } as unknown as NextRequest
}

// ── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/gallery', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns only active images to public', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    vi.mocked(prisma.galleryImage.findMany).mockResolvedValue([ACTIVE_IMAGE])

    const res  = await GET(getReq())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toHaveLength(1)
    expect(prisma.galleryImage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } })
    )
  })

  it('admin without the flag still gets active-only (public home must never leak hidden)', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.galleryImage.findMany).mockResolvedValue([ACTIVE_IMAGE])

    await GET(getReq())

    expect(prisma.galleryImage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isActive: true } })
    )
  })

  it('returns all images (including hidden) to admin with ?includeInactive=true', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.galleryImage.findMany).mockResolvedValue([ACTIVE_IMAGE, INACTIVE_IMAGE])

    const res  = await GET(getReq('http://localhost/api/gallery?includeInactive=true'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toHaveLength(2)
    expect(prisma.galleryImage.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} })
    )
  })

  it('includes url in every image', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    vi.mocked(prisma.galleryImage.findMany).mockResolvedValue([ACTIVE_IMAGE])

    const json = await (await GET(getReq())).json()
    expect(json.data[0].url).toContain('img-1.jpg')
  })

  it('includes s3Key only for admin', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    vi.mocked(prisma.galleryImage.findMany).mockResolvedValue([ACTIVE_IMAGE])
    const publicJson = await (await GET(getReq())).json()
    expect(publicJson.data[0].s3Key).toBeUndefined()

    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.galleryImage.findMany).mockResolvedValue([ACTIVE_IMAGE])
    const adminJson = await (await GET(getReq())).json()
    expect(adminJson.data[0].s3Key).toBe('gallery/img-1.jpg')
  })
})

// ── POST ─────────────────────────────────────────────────────────────────────

describe('POST /api/gallery', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await POST(makeRequest({ s3Key: 'gallery/x.jpg' }))
    expect(res.status).toBe(401)
  })

  it('returns 400 for malformed JSON', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    const req = { json: () => Promise.reject(new Error('bad')) } as unknown as NextRequest
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for empty s3Key', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    const res = await POST(makeRequest({ s3Key: '' }))
    expect(res.status).toBe(400)
  })

  it('creates image and returns 201 with url', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.galleryImage.findFirst).mockResolvedValue({ order: 3 })
    vi.mocked(prisma.galleryImage.create).mockResolvedValue(ACTIVE_IMAGE)

    const res  = await POST(makeRequest({ s3Key: 'gallery/new.jpg', title: 'Nueva' }))
    const json = await res.json()

    expect(res.status).toBe(201)
    expect(json.success).toBe(true)
    expect(json.data.url).toContain('img-1.jpg')
  })
})
