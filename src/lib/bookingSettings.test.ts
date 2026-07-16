// src/lib/bookingSettings.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({ prisma: { bookingSettings: { findFirst: vi.fn() } } }))

const { prisma } = await import('@/lib/prisma')
const { getBookingSettings } = await import('./bookingSettings')

beforeEach(() => vi.clearAllMocks())

describe('getBookingSettings', () => {
  it('usa los valores de la BD cuando existen', async () => {
    vi.mocked(prisma.bookingSettings.findFirst).mockResolvedValue({ showProfessionalStep: true, maxAdvanceDays: 30 } as never)
    expect(await getBookingSettings()).toEqual({ showProfessionalStep: true, maxAdvanceDays: 30 })
  })

  it('cae a los defaults cuando no hay config', async () => {
    vi.mocked(prisma.bookingSettings.findFirst).mockResolvedValue(null as never)
    expect(await getBookingSettings()).toEqual({ showProfessionalStep: false, maxAdvanceDays: 90 })
  })

  it('NUNCA lanza: ante un fallo de BD devuelve defaults (SSR no puede caerse por un blip)', async () => {
    vi.mocked(prisma.bookingSettings.findFirst).mockRejectedValue(new Error('db down'))
    expect(await getBookingSettings()).toEqual({ showProfessionalStep: false, maxAdvanceDays: 90 })
  })
})
