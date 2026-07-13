// src/lib/clients.test.ts
import type { Prisma } from '@prisma/client'
import { resolveOrCreateClient } from './clients'

type Row = { id: string; name: string; email: string | null; phone: string | null; phoneNormalized: string | null; deletedAt?: Date | null }
type Where = { id?: string; email?: string; phoneNormalized?: string }
type CreateArgs = { data: { name: string; email?: string | null; phone?: string | null; phoneNormalized?: string | null } }
type UpdateArgs = { where: { id: string }; data: Partial<Row> }

// Minimal in-memory transaction mock that enforces the unique phone/email
// constraints, so the tests exercise the real resolution logic.
function makeTx(seed: Row[] = []) {
  const rows = new Map<string, Row>(seed.map((r) => [r.id, { ...r }]))
  let seq = seed.length
  const match = (where: Where): Row | null => {
    for (const r of rows.values()) {
      if (where.id && r.id === where.id) return r
      if (where.email && r.email === where.email) return r
      if (where.phoneNormalized && r.phoneNormalized === where.phoneNormalized) return r
    }
    return null
  }
  const client = {
    findUnique: async ({ where }: { where: Where }) => match(where),
    create: async ({ data }: CreateArgs) => {
      if (data.phoneNormalized && match({ phoneNormalized: data.phoneNormalized }))
        throw { code: 'P2002', meta: { target: ['phoneNormalized'] } }
      if (data.email && match({ email: data.email }))
        throw { code: 'P2002', meta: { target: ['email'] } }
      const row: Row = {
        id: `c${++seq}`, name: data.name, email: data.email ?? null,
        phone: data.phone ?? null, phoneNormalized: data.phoneNormalized ?? null,
        deletedAt: null,
      }
      rows.set(row.id, row)
      return row
    },
    update: async ({ where, data }: UpdateArgs) => {
      const r = rows.get(where.id)!
      Object.assign(r, data)
      return r
    },
  }
  return { tx: { client } as unknown as Prisma.TransactionClient, rows }
}

describe('resolveOrCreateClient — phone is the identity', () => {
  it('creates a new client with the normalized phone', async () => {
    const { tx, rows } = makeTx()
    const id = await resolveOrCreateClient(tx, { name: 'Ana', phone: '300 000 0000' })
    expect(rows.get(id)!.phoneNormalized).toBe('573000000000')
  })

  it('reuses the same client when the phone matches, regardless of formatting', async () => {
    const { tx } = makeTx()
    const id1 = await resolveOrCreateClient(tx, { name: 'Ana', phone: '3000000000' })
    const id2 = await resolveOrCreateClient(tx, { name: 'maria', phone: '+57 300 000 0000' })
    expect(id2).toBe(id1)
  })

  it('does NOT duplicate when the name varies (Ana → Ana María Pérez) and enriches to the fullest name', async () => {
    const { tx, rows } = makeTx()
    const a = await resolveOrCreateClient(tx, { name: 'Ana', phone: '3000000000' })
    const b = await resolveOrCreateClient(tx, { name: 'Ana María', phone: '3000000000' })
    const c = await resolveOrCreateClient(tx, { name: 'Ana María Pérez', phone: '3000000000' })
    expect(new Set([a, b, c]).size).toBe(1)
    expect(rows.size).toBe(1)
    expect(rows.get(a)!.name).toBe('Ana María Pérez')
  })

  it('never downgrades the name to a shorter/unrelated one', async () => {
    const { tx, rows } = makeTx()
    const id = await resolveOrCreateClient(tx, { name: 'Ana María Pérez', phone: '3000000000' })
    await resolveOrCreateClient(tx, { name: 'maria', phone: '3000000000' })
    expect(rows.get(id)!.name).toBe('Ana María Pérez')
  })

  it('fills a missing email on the matched client', async () => {
    const { tx, rows } = makeTx()
    const id = await resolveOrCreateClient(tx, { name: 'Ana', phone: '3000000000' })
    await resolveOrCreateClient(tx, { name: 'Ana', email: 'ana@x.com', phone: '3000000000' })
    expect(rows.get(id)!.email).toBe('ana@x.com')
  })

  it('does not hijack an email that already belongs to another client', async () => {
    const { tx, rows } = makeTx([
      { id: 'other', name: 'Otra', email: 'taken@x.com', phone: '3111111111', phoneNormalized: '573111111111' },
    ])
    const id = await resolveOrCreateClient(tx, { name: 'Ana', email: 'taken@x.com', phone: '3000000000' })
    expect(id).not.toBe('other')
    expect(rows.get(id)!.email).toBeNull()
  })

  // The public self-service route blocks archived clients upstream (403); this
  // reactivation therefore applies to admin/manual bookings.
  it('reactivates an archived client when resolved by a booking (admin/manual flow)', async () => {
    const { tx, rows } = makeTx([
      { id: 'arch', name: 'Ana', email: null, phone: '3000000000', phoneNormalized: '573000000000', deletedAt: new Date() },
    ])
    const id = await resolveOrCreateClient(tx, { name: 'Ana', phone: '3000000000' })
    expect(id).toBe('arch')
    expect(rows.get('arch')!.deletedAt).toBeNull()
  })
})
