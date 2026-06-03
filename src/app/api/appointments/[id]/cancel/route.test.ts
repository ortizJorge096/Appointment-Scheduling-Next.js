import { NextRequest } from 'next/server'
import { POST } from './route'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    appointment: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

const { prisma } = await import('@/lib/prisma')

interface MockAppointment {
  id: string
  cancelToken: string
  status: string
  date: Date
  startTime: string
}

// Fecha futura con más de 12h de margen
function futureDate(hoursFromNow: number): Date {
  return new Date(Date.now() + hoursFromNow * 60 * 60 * 1000)
}

function makeAppointment(hoursFromNow: number, overrides: Partial<MockAppointment> = {}): MockAppointment {
  const d = futureDate(hoursFromNow)
  return {
    id: '1',
    cancelToken: 'tok',
    status: 'CONFIRMED',
    date: d,
    startTime: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
    ...overrides,
  }
}

function makeRequest(body?: unknown): NextRequest {
  return {
    json: () => Promise.resolve(body),
  } as NextRequest
}

describe('POST /api/appointments/[id]/cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 400 for invalid JSON body', async () => {
    const req = { json: () => Promise.reject(new Error('parse error')) } as NextRequest
    const res = await POST(req, { params: Promise.resolve({ id: '123' }) })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Body inválido')
  })

  it('returns 400 when token is missing', async () => {
    const res = await POST(makeRequest({}), { params: Promise.resolve({ id: '123' }) })
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('Token requerido')
  })

  it('returns 404 when appointment not found', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(null)
    const res = await POST(makeRequest({ token: 'abc' }), { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
    const json = await res.json()
    expect(json.error).toBe('Cita no encontrada')
  })

  it('returns 403 when token does not match', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(
      makeAppointment(24, { cancelToken: 'correct-token' }) satisfies MockAppointment
    )
    const res = await POST(makeRequest({ token: 'wrong-token' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(403)
    const json = await res.json()
    expect(json.error).toBe('Token inválido')
  })

  it('returns already cancelled when status is CANCELLED', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(
      makeAppointment(24, { status: 'CANCELLED' }) satisfies MockAppointment
    )
    const res = await POST(makeRequest({ token: 'tok' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.alreadyCancelled).toBe(true)
  })

  it('returns 409 when less than 12 hours remain', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(
      makeAppointment(6) satisfies MockAppointment
    )
    const res = await POST(makeRequest({ token: 'tok' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(409)
    const json = await res.json()
    expect(json.error).toContain('12 horas')
  })

  it('cancels appointment when token matches and more than 12h remain', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(
      makeAppointment(24) satisfies MockAppointment
    )
    vi.mocked(prisma.appointment.update).mockResolvedValue({} satisfies Record<string, never>)
    const res = await POST(makeRequest({ token: 'tok' }), { params: Promise.resolve({ id: '1' }) })
    expect(res.status).toBe(200)
    expect(prisma.appointment.update).toHaveBeenCalledWith({
      where: { id: '1' },
      data: { status: 'CANCELLED' },
    })
    const json = await res.json()
    expect(json.success).toBe(true)
  })
})
