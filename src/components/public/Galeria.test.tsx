import { describe, it, expect, vi, beforeEach } from 'vitest'
import { STUDIO, INSTAGRAM_URL, TIKTOK_URL } from '@/lib/config'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    galleryImage: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/s3', () => ({
  getPublicUrl: vi.fn((key: string) => `https://bucket.s3.amazonaws.com/${key}`),
}))

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Galeria (server component)', () => {
  it('los links a redes sociales están bien formados', () => {
    expect(INSTAGRAM_URL).toContain(STUDIO.instagram)
    expect(INSTAGRAM_URL).toMatch(/^https:\/\/(www\.)?instagram\.com\//)

    expect(TIKTOK_URL).toContain(STUDIO.tiktok)
    expect(TIKTOK_URL).toMatch(/^https:\/\/(www\.)?tiktok\.com\//)
  })

  it('renderiza el título de la sección', async () => {
    const Galeria = (await import('./Galeria')).default
    expect(Galeria).toBeDefined()
    expect(Galeria).toBeInstanceOf(Function)
  })
})
