// src/app/api/testimonials/upload-url/route.test.ts
import { NextRequest } from 'next/server'

vi.mock('@/lib/authz', () => ({ getCurrentAdmin: vi.fn() }))
vi.mock('@/lib/s3', () => ({
  getPresignedUploadUrl: vi.fn(),
  getPublicUrl:          vi.fn((k: string) => `https://cdn/${k}`),
  buildTestimonialKey:   vi.fn((id: string, f: string) => `testimonios/${id}-${f}`),
}))
// Real @/lib/permissions + @/lib/validations.

const { getCurrentAdmin } = await import('@/lib/authz')
const s3                  = await import('@/lib/s3')
const { POST }            = await import('./route')

const ADMIN = { id: 'a1', email: 'a@t.com', name: 'Admin', role: 'ADMIN' }
const VALID = { filename: 'foto.jpg', contentType: 'image/jpeg' }
const req = (body: unknown) => ({ json: () => Promise.resolve(body) } as unknown as NextRequest)

beforeEach(() => vi.clearAllMocks())

describe('POST /api/testimonials/upload-url', () => {
  it('401 sin sesión', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(null)
    expect((await POST(req(VALID))).status).toBe(401)
  })

  it('403 sin testimonios:editar (recepcionista)', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue({ ...ADMIN, role: 'RECEPCIONISTA' })
    expect((await POST(req(VALID))).status).toBe(403)
    expect(s3.getPresignedUploadUrl).not.toHaveBeenCalled()
  })

  it('400 con contentType no permitido', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(ADMIN)
    const res = await POST(req({ filename: 'a.exe', contentType: 'application/octet-stream' }))
    expect(res.status).toBe(400)
  })

  it('200: firma el PUT y devuelve también la publicUrl', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(ADMIN)
    vi.mocked(s3.getPresignedUploadUrl).mockResolvedValue({ uploadUrl: 'https://s3/put', key: 'k' } as never)
    const res = await POST(req(VALID))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.data.uploadUrl).toBe('https://s3/put')
    expect(body.data.publicUrl).toMatch(/^https:\/\/cdn\/testimonios\//)
    expect(s3.buildTestimonialKey).toHaveBeenCalled()
  })

  it('500 si falla la firma en S3', async () => {
    vi.mocked(getCurrentAdmin).mockResolvedValue(ADMIN)
    vi.mocked(s3.getPresignedUploadUrl).mockRejectedValue(new Error('S3 down'))
    expect((await POST(req(VALID))).status).toBe(500)
  })
})
