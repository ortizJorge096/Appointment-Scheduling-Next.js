// src/app/api/hero/[id]/route.test.ts
import { NextRequest } from 'next/server'
import { PATCH, DELETE } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: { heroImage: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() } },
}))
vi.mock('@/lib/s3', () => ({
  deleteObject: vi.fn(),
  getPublicUrl: vi.fn((k: string) => `https://cdn.example.com/${k}`),
}))
vi.mock('@/lib/audit', () => ({ audit: vi.fn(), getClientIp: vi.fn(() => '127.0.0.1') }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { getServerSession } = await import('next-auth')
const { prisma }           = await import('@/lib/prisma')
const { deleteObject }     = await import('@/lib/s3')
const { revalidatePath }   = await import('next/cache')

const HERO = { id: 'h1', s3Key: 'hero/h1.jpg', order: 1, isActive: true, focalPoint: 'center center', createdAt: new Date(), updatedAt: new Date() }
const CTX  = (id = 'h1') => ({ params: Promise.resolve({ id }) })
function req(body?: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest
}

describe('PATCH /api/hero/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    expect((await PATCH(req({ isActive: false }), CTX())).status).toBe(401)
  })

  it('updates the focal point and refreshes the landing', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.heroImage.update).mockResolvedValue({ ...HERO, focalPoint: 'top center' })

    const res = await PATCH(req({ focalPoint: 'top center' }), CTX())
    expect(res.status).toBe(200)
    expect(prisma.heroImage.update).toHaveBeenCalledWith(expect.objectContaining({ data: { focalPoint: 'top center' } }))
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })

  it('deletes the previous S3 object when the image is replaced', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.heroImage.findUnique).mockResolvedValue({ s3Key: 'hero/old.jpg' })
    vi.mocked(prisma.heroImage.update).mockResolvedValue({ ...HERO, s3Key: 'hero/new.jpg' })

    await PATCH(req({ s3Key: 'hero/new.jpg' }), CTX())
    expect(deleteObject).toHaveBeenCalledWith('hero/old.jpg')
  })
})

describe('DELETE /api/hero/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when not found', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.heroImage.findUnique).mockResolvedValue(null)
    expect((await DELETE(req(), CTX('missing'))).status).toBe(404)
  })

  it('deletes the S3 object and the record, then refreshes the landing', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(prisma.heroImage.findUnique).mockResolvedValue(HERO)
    vi.mocked(prisma.heroImage.delete).mockResolvedValue(HERO)

    const res = await DELETE(req(), CTX())
    expect(res.status).toBe(200)
    expect(deleteObject).toHaveBeenCalledWith('hero/h1.jpg')
    expect(prisma.heroImage.delete).toHaveBeenCalledWith({ where: { id: 'h1' } })
    expect(revalidatePath).toHaveBeenCalledWith('/')
  })
})
