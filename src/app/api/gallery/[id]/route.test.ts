// src/app/api/gallery/[id]/route.test.ts
import { NextRequest } from 'next/server'
import { PATCH, DELETE } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    galleryImage: {
      findUnique: vi.fn(),
      update:     vi.fn(),
      delete:     vi.fn(),
    },
  },
}))
vi.mock('@/lib/s3', () => ({
  deleteObject:  vi.fn().mockResolvedValue(undefined),
  getPublicUrl:  vi.fn((key: string) => `https://cdn.example.com/${key}`),
}))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')
const { deleteObject }     = await import('@/lib/s3')

const MOCK_IMAGE = {
  id: 'img-1', s3Key: 'gallery/img-1.jpg', title: 'Test', description: null,
  category: null, width: 800, height: 600, order: 1, isActive: true, createdAt: new Date(),
}

const CTX = (id = 'img-1') => ({ params: Promise.resolve({ id }) })

function makeRequest(body?: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest
}

// ── PATCH ────────────────────────────────────────────────────────────────────

describe('PATCH /api/gallery/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ isActive: false }), CTX())
    expect(res.status).toBe(401)
  })

  it('returns 400 for malformed JSON', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    const req = { json: () => Promise.reject(new Error('bad')) } as unknown as NextRequest
    const res = await PATCH(req, CTX())
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid body schema', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    const res = await PATCH(makeRequest({ order: -1 }), CTX())
    expect(res.status).toBe(400)
  })

  it('returns 404 when image not found', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.galleryImage.update).mockRejectedValue(new Error('Not found'))
    const res = await PATCH(makeRequest({ isActive: false }), CTX('missing'))
    expect(res.status).toBe(404)
  })

  it('updates image metadata successfully', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.galleryImage.update).mockResolvedValue({ ...MOCK_IMAGE, isActive: false })

    const res  = await PATCH(makeRequest({ isActive: false }), CTX())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.url).toContain('img-1.jpg')
  })

  it('deletes old S3 object when s3Key changes', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.galleryImage.findUnique).mockResolvedValue(MOCK_IMAGE)
    vi.mocked(prisma.galleryImage.update).mockResolvedValue({ ...MOCK_IMAGE, s3Key: 'gallery/new.jpg' })

    await PATCH(makeRequest({ s3Key: 'gallery/new.jpg' }), CTX())

    expect(deleteObject).toHaveBeenCalledWith('gallery/img-1.jpg')
  })
})

// ── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/gallery/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await DELETE(makeRequest(), CTX())
    expect(res.status).toBe(401)
  })

  it('returns 404 when image not found', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.galleryImage.findUnique).mockResolvedValue(null)
    const res = await DELETE(makeRequest(), CTX('missing'))
    expect(res.status).toBe(404)
  })

  it('deletes from S3 and DB, returns id', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.galleryImage.findUnique).mockResolvedValue(MOCK_IMAGE)
    vi.mocked(prisma.galleryImage.delete).mockResolvedValue(MOCK_IMAGE)

    const res  = await DELETE(makeRequest(), CTX())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.deleted).toBe(true)
    expect(json.data.id).toBe('img-1')
    expect(deleteObject).toHaveBeenCalledWith('gallery/img-1.jpg')
    expect(prisma.galleryImage.delete).toHaveBeenCalledWith({ where: { id: 'img-1' } })
  })
})
