// src/app/api/availability/route.test.ts
import { NextRequest } from 'next/server'
import { GET } from './route'

vi.mock('@/lib/availability', () => ({
  getAvailableSlots: vi.fn(),
  getAvailableSlotsByDuration: vi.fn(),
}))

const { getAvailableSlots, getAvailableSlotsByDuration } = await import('@/lib/availability')

const MOCK_SLOTS = [
  { startTime: '09:00', endTime: '09:45', available: true  },
  { startTime: '09:30', endTime: '10:15', available: false },
  { startTime: '10:00', endTime: '10:45', available: true  },
]

function makeRequest(params: Record<string, string> = {}): NextRequest {
  const url = new URL('http://localhost/api/availability')
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  return { url: url.toString() } as unknown as NextRequest
}

describe('GET /api/availability', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 400 when date is missing', async () => {
    const res  = await GET(makeRequest({ serviceId: 'clxxxxxxxxxxxxxxxxxxxxxxx' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when both serviceId and durationMinutes are missing', async () => {
    const res = await GET(makeRequest({ date: '2026-12-01' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid date format', async () => {
    const res = await GET(makeRequest({ date: '01/12/2026', serviceId: 'clxxxxxxxxxxxxxxxxxxxxxxx' }))
    expect(res.status).toBe(400)
  })

  // The schema validates presence, not id encoding — a non-existent id is the
  // DB's job, and pinning the format rejected real uuid rows (see the categories
  // fix). An empty serviceId is what a caller can actually get wrong.
  it('returns 400 for an empty serviceId', async () => {
    const res = await GET(makeRequest({ date: '2026-12-01', serviceId: '' }))
    expect(res.status).toBe(400)
  })

  it('returns available slots on valid request with serviceId', async () => {
    vi.mocked(getAvailableSlots).mockResolvedValue({ slots: MOCK_SLOTS, durationMinutes: 45 })

    const res  = await GET(makeRequest({ date: '2026-12-01', serviceId: 'clxxxxxxxxxxxxxxxxxxxxxxx' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.slots).toHaveLength(3)
    expect(json.data.serviceDuration).toBe(45)
    expect(json.data.date).toBe('2026-12-01')
  })

  it('returns available slots on valid request with durationMinutes', async () => {
    vi.mocked(getAvailableSlotsByDuration).mockResolvedValue({ slots: MOCK_SLOTS, durationMinutes: 90 })

    const res  = await GET(makeRequest({ date: '2026-12-01', durationMinutes: '90' }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.slots).toHaveLength(3)
    expect(json.data.serviceDuration).toBe(90)
  })

  it('returns 500 when getAvailableSlots throws', async () => {
    vi.mocked(getAvailableSlots).mockRejectedValue(new Error('Servicio no encontrado o inactivo'))
    const res = await GET(makeRequest({ date: '2026-12-01', serviceId: 'clxxxxxxxxxxxxxxxxxxxxxxx' }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toContain('Servicio')
  })
})
