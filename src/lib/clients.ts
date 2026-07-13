// src/lib/clients.ts
// Single source of truth for resolving/creating the Client a booking belongs to.
// Used by BOTH the public (/api/appointments) and manual (/api/appointments/manual)
// flows so client identity is consistent everywhere.
//
// Identity = the PHONE number (normalized). One phone → one client. Names vary
// ("Ana" vs "Ana María Pérez") and email is optional, so the phone is the stable
// key; the name is enriched to its most complete form over time. Email is a
// secondary unique key and never hijacked from another client.

import type { Prisma } from '@prisma/client'
import { normalizePhone } from './utils'

interface ClientInput {
  name: string
  email?: string | null
  phone: string
}

// Lowercased, accent-stripped tokens of a name, for comparing completeness.
function nameTokens(name: string): string[] {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .split(/\s+/)
    .filter(Boolean)
}

// True when `candidate` is a strictly richer version of `current`: it contains
// every token of `current` plus more (e.g. "Ana" → "Ana María Pérez"). This
// never replaces a name with an unrelated one, so enriching is always safe.
function isMoreComplete(candidate: string, current: string): boolean {
  const c = nameTokens(candidate)
  const cur = nameTokens(current)
  if (c.length <= cur.length) return false
  return cur.every((t) => c.includes(t))
}

/**
 * Resolves an existing client or creates one, returning the client id.
 *
 * Identity rules (phone is the primary key):
 *  - Match by normalized phone. Found → reuse it, enriching the name to the more
 *    complete version and filling a missing email (only if that email is free).
 *  - Not found → create a new client with the normalized phone. If the provided
 *    email already belongs to another client, it's dropped (phone is the identity;
 *    we never steal another client's unique email).
 *  - No usable phone (edge, e.g. admin-imported data) → fall back to email, else
 *    create a bare client.
 *
 * MUST run inside a transaction (tx) so the client and the appointment are atomic.
 */
export async function resolveOrCreateClient(
  tx: Prisma.TransactionClient,
  { name, email, phone }: ClientInput,
): Promise<string> {
  const nameNorm  = name.trim()
  const phoneNorm = normalizePhone(phone)
  const emailNorm = email?.toLowerCase().trim() || null

  // ── Phone is the identity ──
  if (phoneNorm) {
    const existing = await tx.client.findUnique({
      where:  { phoneNormalized: phoneNorm },
      select: { id: true, name: true, email: true, deletedAt: true },
    })

    if (existing) {
      const data: Prisma.ClientUpdateInput = {}
      // Reactivate an archived client when a booking resolves to them. The public
      // self-service route rejects archived clients upstream (403 CLIENT_INACTIVE),
      // so this only fires for admin/manual bookings — where re-serving a client
      // means they're active again.
      if (existing.deletedAt) data.deletedAt = null
      if (isMoreComplete(nameNorm, existing.name)) data.name = nameNorm
      // Fill a missing email only if it isn't already taken by someone else.
      if (emailNorm && !existing.email) {
        const taken = await tx.client.findUnique({ where: { email: emailNorm }, select: { id: true } })
        if (!taken) data.email = emailNorm
      }
      if (Object.keys(data).length > 0) {
        await tx.client.update({ where: { id: existing.id }, data })
      }
      return existing.id
    }

    // New phone → create. Don't hijack another client's unique email.
    let createEmail = emailNorm
    if (createEmail) {
      const taken = await tx.client.findUnique({ where: { email: createEmail }, select: { id: true } })
      if (taken) createEmail = null
    }
    try {
      const created = await tx.client.create({
        data: { name: nameNorm, email: createEmail, phone: phone.trim(), phoneNormalized: phoneNorm },
      })
      return created.id
    } catch (err) {
      // Lost a race on the unique phone → another tx just created it; reuse.
      if ((err as { code?: string }).code === 'P2002') {
        const raced = await tx.client.findUnique({ where: { phoneNormalized: phoneNorm }, select: { id: true } })
        if (raced) return raced.id
      }
      throw err
    }
  }

  // ── No usable phone (edge) → fall back to email, else a bare client ──
  if (emailNorm) {
    const client = await tx.client.upsert({
      where:  { email: emailNorm },
      create: { name: nameNorm, email: emailNorm, phone: phone.trim() || null },
      update: { name: nameNorm },
    })
    return client.id
  }

  const created = await tx.client.create({
    data: { name: nameNorm, phone: phone.trim() || null },
  })
  return created.id
}
