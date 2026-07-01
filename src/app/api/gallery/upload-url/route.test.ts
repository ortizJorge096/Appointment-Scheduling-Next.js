// src/app/api/gallery/upload-url/route.test.ts
import { NextRequest } from 'next/server'
import { POST } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/s3', () => ({
  getPresignedUploadUrl: vi.fn(),
  buildGalleryKey:       vi.fn((id: string, filename: string) => {
    const ext = filename.split('.').pop()
    return `gallery/${id}.${ext}`
  }),
}))

const { getServerSession }      = await import('next-auth')
const { getPresignedUploadUrl } = await import('@/lib/s3')

const VALID_BODY = { filename: 'photo.jpg', contentType: 'image/jpeg' }

function makeRequest(body?: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest
}

describe('POST /api/gallery/upload-url', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await POST(makeRequest(VALID_BODY))
    expect(res.status).toBe(401)
  })

  it('returns 400 for malformed JSON', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    const req = { json: () => Promise.reject(new Error('bad')) } as unknown as NextRequest
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns 400 for unsupported content type', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    const res = await POST(makeRequest({ filename: 'file.gif', contentType: 'image/gif' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain('JPG')
  })

  it('returns 400 for empty filename', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    const res = await POST(makeRequest({ filename: '', contentType: 'image/jpeg' }))
    expect(res.status).toBe(400)
  })

  it('returns presigned URL on valid request', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(getPresignedUploadUrl).mockResolvedValue({
      uploadUrl: 'https://s3.amazonaws.com/bucket/gallery/abc.jpg?sig=xyz',
      key:       'gallery/abc.jpg',
      expiresIn: 300,
    })

    const res  = await POST(makeRequest(VALID_BODY))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.uploadUrl).toContain('s3.amazonaws.com')
    expect(json.data.key).toContain('gallery/')
    expect(json.data.expiresIn).toBe(300)
  })

  it('returns 500 when S3 presign fails', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(getPresignedUploadUrl).mockRejectedValue(new Error('AWS_S3_BUCKET no está configurado'))

    const res  = await POST(makeRequest(VALID_BODY))
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.error).toContain('AWS_S3_BUCKET')
  })

  it('accepts image/png content type', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(getPresignedUploadUrl).mockResolvedValue({
      uploadUrl: 'https://s3.amazonaws.com/bucket/gallery/abc.png?sig=xyz',
      key:       'gallery/abc.png',
      expiresIn: 300,
    })

    const res = await POST(makeRequest({ filename: 'photo.png', contentType: 'image/png' }))
    expect(res.status).toBe(200)
  })

  it('accepts image/webp content type', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'a1', role: 'SUPER_ADMIN' } })
    vi.mocked(getPresignedUploadUrl).mockResolvedValue({
      uploadUrl: 'https://s3.amazonaws.com/bucket/gallery/abc.webp?sig=xyz',
      key:       'gallery/abc.webp',
      expiresIn: 300,
    })

    const res = await POST(makeRequest({ filename: 'photo.webp', contentType: 'image/webp' }))
    expect(res.status).toBe(200)
  })
})
