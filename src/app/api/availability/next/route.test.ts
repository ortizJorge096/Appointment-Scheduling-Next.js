// src/app/api/availability/next/route.test.ts
import { GET } from './route'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    service: { findMany: vi.fn() },
  },
}))

vi.mock('@/lib/availability', () => ({
  getAvailableSlots: vi.fn(),
}))

const { prisma }           = await import('@/lib/prisma')
const { getAvailableSlots } = await import('@/lib/availability')

const MOCK_SERVICES = [
  { id: 's1', name: 'Manicura', price: 35000, durationMinutes: 45, order: 1 },
  { id: 's2', name: 'Lifting',  price: 80000, durationMinutes: 60, order: 2 },
]

describe('GET /api/availability/next', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns null when no active services exist', async () => {
    vi.mocked(prisma.service.findMany).mockResolvedValue([])

    const res  = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toBeNull()
  })

  it('returns first available slot across services', async () => {
    vi.mocked(prisma.service.findMany).mockResolvedValue(MOCK_SERVICES)
    vi.mocked(getAvailableSlots).mockResolvedValue({
      slots: [
        { startTime: '09:00', endTime: '09:45', available: true },
      ],
      durationMinutes: 45,
    })

    const res  = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toMatchObject({
      startTime: '09:00',
      service: { id: 's1' },
    })
  })

  it('returns null when no slot found in 14 days', async () => {
    vi.mocked(prisma.service.findMany).mockResolvedValue(MOCK_SERVICES)
    vi.mocked(getAvailableSlots).mockResolvedValue({ slots: [], durationMinutes: 45 })

    const res  = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toBeNull()
  })

  it('skips a service when getAvailableSlots throws and continues with next', async () => {
    vi.mocked(prisma.service.findMany).mockResolvedValue(MOCK_SERVICES)
    vi.mocked(getAvailableSlots)
      .mockRejectedValueOnce(new Error('Servicio no encontrado'))
      .mockResolvedValue({
        slots: [{ startTime: '10:00', endTime: '11:00', available: true }],
        durationMinutes: 60,
      })

    const res  = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).not.toBeNull()
    expect(json.data.service.id).toBe('s2')
  })

  it('returns 500 on unexpected prisma error', async () => {
    vi.mocked(prisma.service.findMany).mockRejectedValue(new Error('DB down'))

    const res = await GET()
    expect(res.status).toBe(500)
  })
})
