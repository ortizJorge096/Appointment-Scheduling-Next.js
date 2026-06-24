// src/lib/audit.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./prisma', () => ({ prisma: { auditLog: { create: vi.fn() } } }))

const { prisma } = await import('./prisma')
const { audit }  = await import('./audit')

describe('audit()', () => {
  beforeEach(() => vi.clearAllMocks())

  it('defaults actorType to ADMIN when omitted', async () => {
    await audit({ action: 'UPDATE', entity: 'SERVICE', entityId: 's1' })
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorType: 'ADMIN', action: 'UPDATE', entityId: 's1' }),
    })
  })

  it('respects an explicit actorType (CLIENT / SYSTEM)', async () => {
    await audit({ action: 'CREATE', entity: 'APPOINTMENT', entityId: 'a1', actorType: 'CLIENT' })
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ actorType: 'CLIENT' }),
    })
  })

  it('NEVER throws even if the audit write fails — the main op must survive', async () => {
    vi.mocked(prisma.auditLog.create).mockRejectedValueOnce(new Error('db down'))
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(
      audit({ action: 'CREATE', entity: 'CLIENT', entityId: 'c1' }),
    ).resolves.toBeUndefined()
    errSpy.mockRestore()
  })

  it('passes before/after through without inventing data', async () => {
    await audit({ action: 'CANCEL', entity: 'APPOINTMENT', entityId: 'a1', before: { status: 'CONFIRMED' }, after: { status: 'CANCELLED' } })
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ before: { status: 'CONFIRMED' }, after: { status: 'CANCELLED' } }),
    })
  })
})
