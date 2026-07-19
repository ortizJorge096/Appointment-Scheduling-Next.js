// src/app/api/cron/route.test.ts
import { NextRequest } from 'next/server'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    appointment: { findMany: vi.fn(), update: vi.fn() },
    client:      { updateMany: vi.fn() },
  },
}))
vi.mock('@/lib/email', () => ({
  sendReminderEmail: vi.fn().mockResolvedValue(undefined),
  sendFollowUpEmail: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('@/lib/audit', () => ({ audit: vi.fn() }))

const { prisma }                               = await import('@/lib/prisma')
const { sendReminderEmail, sendFollowUpEmail }  = await import('@/lib/email')
const { audit }                                 = await import('@/lib/audit')
const { POST }                                  = await import('./route')

function req(secret?: string): NextRequest {
  const headers = new Headers()
  if (secret) headers.set('authorization', `Bearer ${secret}`)
  return { headers } as unknown as NextRequest
}

describe('POST /api/cron', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.CRON_SECRET = 'test-secret'
    vi.mocked(prisma.appointment.findMany).mockResolvedValue([])
    vi.mocked(prisma.appointment.update).mockResolvedValue({} as never)
    vi.mocked(prisma.client.updateMany).mockResolvedValue({ count: 0 } as never)
  })
  afterEach(() => { delete process.env.CRON_SECRET })

  it('returns 401 without the shared secret', async () => {
    expect((await POST(req())).status).toBe(401)
    expect((await POST(req('wrong'))).status).toBe(401)
  })

  it('sends day-before reminders, follow-ups and archives inactive clients (idempotent flags set)', async () => {
    // First findMany = reminders (tomorrow); second = follow-ups (yesterday).
    vi.mocked(prisma.appointment.findMany)
      .mockResolvedValueOnce([{ id: 'a1', clientEmail: 'x@y.com', service: { name: 'Manicura' }, services: [] }] as never)
      .mockResolvedValueOnce([{ id: 'a2', clientEmail: 'z@y.com', service: { name: 'Pedicura' }, services: [] }] as never)
    vi.mocked(prisma.client.updateMany).mockResolvedValue({ count: 3 } as never)

    const res  = await POST(req('test-secret'))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data).toEqual({ remindersSent: 1, followUpsSent: 1, clientsArchived: 3 })
    expect(sendReminderEmail).toHaveBeenCalledTimes(1)
    expect(sendFollowUpEmail).toHaveBeenCalledTimes(1)
    // The idempotency flags are stamped so a re-run never double-sends.
    expect(prisma.appointment.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'a1' }, data: { reminderSentAt: expect.any(Date) } }))
    expect(prisma.appointment.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'a2' }, data: { followUpSentAt: expect.any(Date) } }))
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ entity: 'CLIENT', actorType: 'SYSTEM' }))
  })
})
