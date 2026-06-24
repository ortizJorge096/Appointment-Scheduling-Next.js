// src/lib/clients.ts
// Single source of truth for resolving/creating the Client a booking belongs to.
// Used by BOTH the public (/api/appointments) and manual (/api/appointments/manual)
// flows so client identity is consistent everywhere.

import type { Prisma } from '@prisma/client'

interface ClientInput {
  name: string
  email?: string | null
  phone: string
}

/**
 * Resolves an existing client or creates one, returning the client id.
 *
 * Identity rules:
 *  - With email   → upsert by email (email is the unique key; refreshes name/phone).
 *  - Without email → match by normalized phone + case-insensitive name. Both must
 *    match (so we don't merge two people who share a phone, e.g. family). No match
 *    → create a new client with email = null.
 *
 * MUST run inside a transaction (tx) so the client and the appointment are atomic.
 */
export async function resolveOrCreateClient(
  tx: Prisma.TransactionClient,
  { name, email, phone }: ClientInput,
): Promise<string> {
  const nameNorm  = name.trim()
  const phoneNorm = phone.trim()
  const emailNorm = email?.toLowerCase().trim() || null

  if (emailNorm) {
    const client = await tx.client.upsert({
      where:  { email: emailNorm },
      create: { name: nameNorm, email: emailNorm, phone: phoneNorm },
      update: { name: nameNorm, phone: phoneNorm },
    })
    return client.id
  }

  // No email — dedup by phone + name (both must match).
  const existing = await tx.client.findFirst({
    where: {
      email: null,
      phone: phoneNorm,
      name:  { equals: nameNorm, mode: 'insensitive' },
    },
    select: { id: true },
  })
  if (existing) return existing.id

  const created = await tx.client.create({
    data: { name: nameNorm, email: null, phone: phoneNorm },
  })
  return created.id
}
