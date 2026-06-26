// src/app/api/appointments/[id]/route.test.ts
import { NextRequest } from 'next/server'
import { GET, PATCH, DELETE } from './route'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/auth', () => ({ authOptions: {} }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    appointment: {
      findUnique: vi.fn(),
      update:     vi.fn(),
    },
  },
}))
vi.mock('@/lib/availability', () => ({
  timeToMinutes: vi.fn((t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }),
  minutesToTime: vi.fn((min: number) => {
    const h = Math.floor(min / 60)
    const m = min % 60
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  }),
}))
vi.mock('@/lib/email', () => ({ sendRescheduledEmail: vi.fn().mockResolvedValue(undefined) }))

const { getServerSession }     = await import('next-auth')
const { prisma }               = await import('@/lib/prisma')
const { sendRescheduledEmail } = await import('@/lib/email')

const MOCK_SERVICE = { id: 's1', name: 'Manicura', price: 35000, durationMinutes: 45 }

const MOCK_APPOINTMENT = {
  id:          'appt-1',
  clientName:  'María García',
  clientEmail: 'maria@test.com',
  clientPhone: '3001234567',
  clientId:    null,
  serviceId:   's1',
  date:        new Date('2026-12-01'),
  startTime:   '10:00',
  endTime:     '10:45',
  status:      'CONFIRMED',
  source:      'ONLINE',
  paymentStatus: 'PENDING',
  paymentMethod: null,
  amountPaid: null,
  notes:       null,
  cancelToken: null,
  confirmationSentAt: null,
  reminderSentAt:     null,
  createdAt:          new Date(),
  calendarEventId:    null,
  totalDurationMinutes: 45,
  service: MOCK_SERVICE,
  services: [],
  extras:   [],
}

const CTX = (id = 'appt-1') => ({ params: Promise.resolve({ id }) })

function makeRequest(body?: unknown): NextRequest {
  return { json: () => Promise.resolve(body) } as unknown as NextRequest
}

// ── GET ──────────────────────────────────────────────────────────────────────

describe('GET /api/appointments/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when appointment not found', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(null)
    const res = await GET(makeRequest(), CTX())
    expect(res.status).toBe(404)
  })

  it('returns full appointment to admin', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(MOCK_APPOINTMENT)
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })

    const json = await (await GET(makeRequest(), CTX())).json()
    expect(json.success).toBe(true)
    expect(json.data.clientPhone).toBeDefined()
  })

  it('returns only public fields to unauthenticated user', async () => {
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(MOCK_APPOINTMENT)
    vi.mocked(getServerSession).mockResolvedValue(null)

    const json = await (await GET(makeRequest(), CTX())).json()
    expect(json.success).toBe(true)
    expect(json.data.clientPhone).toBeUndefined()
    expect(json.data.clientName).toBeDefined()
  })
})

// ── PATCH ────────────────────────────────────────────────────────────────────

describe('PATCH /api/appointments/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ status: 'CONFIRMED' }), CTX())
    expect(res.status).toBe(401)
  })

  it('returns 404 when appointment not found', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(null)
    const res = await PATCH(makeRequest({ status: 'CONFIRMED' }), CTX('missing'))
    expect(res.status).toBe(404)
  })

  it('returns 400 for malformed JSON', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(MOCK_APPOINTMENT)
    const req = { json: () => Promise.reject(new Error('bad')) } as unknown as NextRequest
    const res = await PATCH(req, CTX())
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid status value', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(MOCK_APPOINTMENT)
    const res = await PATCH(makeRequest({ status: 'INVALID_STATUS' }), CTX())
    expect(res.status).toBe(400)
  })

  it('updates status successfully', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(MOCK_APPOINTMENT)
    vi.mocked(prisma.appointment.update).mockResolvedValue({ ...MOCK_APPOINTMENT, status: 'COMPLETED' })

    const res  = await PATCH(makeRequest({ status: 'COMPLETED' }), CTX())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) })
    )
    expect(sendRescheduledEmail).not.toHaveBeenCalled()
  })

  it('completes the appointment when a full payment (PAID) is saved', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(MOCK_APPOINTMENT)
    vi.mocked(prisma.appointment.update).mockResolvedValue({ ...MOCK_APPOINTMENT, status: 'COMPLETED', paymentStatus: 'PAID' })

    await PATCH(makeRequest({ paymentStatus: 'PAID', amountPaid: 35000, paymentMethod: 'EFECTIVO' }), CTX())

    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED', paymentStatus: 'PAID' }) })
    )
  })

  it('completes on courtesy (WAIVED) with $0', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(MOCK_APPOINTMENT)
    vi.mocked(prisma.appointment.update).mockResolvedValue({ ...MOCK_APPOINTMENT, status: 'COMPLETED', paymentStatus: 'WAIVED' })

    await PATCH(makeRequest({ paymentStatus: 'WAIVED', amountPaid: 0 }), CTX())

    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED', paymentStatus: 'WAIVED' }) })
    )
  })

  it('does NOT complete the appointment on a partial payment (deposit)', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(MOCK_APPOINTMENT)
    vi.mocked(prisma.appointment.update).mockResolvedValue({ ...MOCK_APPOINTMENT, paymentStatus: 'PARTIAL' })

    await PATCH(makeRequest({ paymentStatus: 'PARTIAL', amountPaid: 10000 }), CTX())

    const call = vi.mocked(prisma.appointment.update).mock.calls[0][0] as { data: Record<string, unknown> }
    expect(call.data.status).toBeUndefined()
  })

  it('does not re-complete a cancelled appointment when a payment is saved', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue({ ...MOCK_APPOINTMENT, status: 'CANCELLED' })
    vi.mocked(prisma.appointment.update).mockResolvedValue({ ...MOCK_APPOINTMENT, status: 'CANCELLED' })

    await PATCH(makeRequest({ paymentStatus: 'PAID', amountPaid: 35000 }), CTX())

    const call = vi.mocked(prisma.appointment.update).mock.calls[0][0] as { data: Record<string, unknown> }
    expect(call.data.status).toBeUndefined()
  })

  it('clears the saved discount when fields are sent as null', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue({
      ...MOCK_APPOINTMENT, descuentoTipo: 'PORCENTAJE', descuentoValor: 10, precioFinal: 31500,
    })
    vi.mocked(prisma.appointment.update).mockResolvedValue(MOCK_APPOINTMENT)

    await PATCH(makeRequest({ descuentoTipo: null, descuentoValor: null, descuentoMotivo: null }), CTX())

    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ descuentoTipo: null, descuentoValor: null, precioFinal: null }) })
    )
  })

  it('sends a reschedule email when date or startTime change', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(MOCK_APPOINTMENT)
    const updated = { ...MOCK_APPOINTMENT, date: new Date('2026-12-05'), startTime: '14:00' }
    vi.mocked(prisma.appointment.update).mockResolvedValue(updated)

    const res = await PATCH(makeRequest({ date: '2026-12-05', startTime: '14:00' }), CTX())
    expect(res.status).toBe(200)
    expect(sendRescheduledEmail).toHaveBeenCalledWith(updated, MOCK_APPOINTMENT.date, '10:00')
  })

  it('does not send a reschedule email if the same request cancels the appointment', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(MOCK_APPOINTMENT)
    vi.mocked(prisma.appointment.update).mockResolvedValue({
      ...MOCK_APPOINTMENT, date: new Date('2026-12-05'), status: 'CANCELLED',
    })

    const res = await PATCH(makeRequest({ date: '2026-12-05', status: 'CANCELLED' }), CTX())
    expect(res.status).toBe(200)
    expect(sendRescheduledEmail).not.toHaveBeenCalled()
  })
})

// ── DELETE ───────────────────────────────────────────────────────────────────

describe('DELETE /api/appointments/[id]', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null)
    const res = await DELETE(makeRequest(), CTX())
    expect(res.status).toBe(401)
  })

  it('returns 404 when appointment not found', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(null)
    const res = await DELETE(makeRequest(), CTX('missing'))
    expect(res.status).toBe(404)
  })

  it('soft-deletes appointment (sets status CANCELLED)', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: {} })
    vi.mocked(prisma.appointment.findUnique).mockResolvedValue(MOCK_APPOINTMENT)
    vi.mocked(prisma.appointment.update).mockResolvedValue({ ...MOCK_APPOINTMENT, status: 'CANCELLED' })

    const res  = await DELETE(makeRequest(), CTX())
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.deleted).toBe(true)
    expect(prisma.appointment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CANCELLED' } })
    )
  })
})
