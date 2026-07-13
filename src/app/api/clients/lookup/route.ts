// src/app/api/clients/lookup/route.ts
// GET /api/clients/lookup?phone=XXX — PUBLIC, minimal-disclosure lookup for the
// booking form's phone-first autofill. Returns ONLY whether a client exists for
// that phone and their name — never the email, appointment history or any other
// PII, so a stranger can't harvest data by guessing numbers. Rate-limited to cap
// enumeration, and fail-safe (any error → "not found" so booking still works).

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizePhone } from '@/lib/utils'
import { isDbUnavailable, dbUnavailableResponse } from '@/lib/db-error'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Cap phone-enumeration: 20 lookups/min per IP, shared across pods (see rate-limit.ts).
const LOOKUP_MAX_PER_MIN = 20

export async function GET(request: NextRequest): Promise<NextResponse> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'

  const rl = await rateLimit(`lookup:${ip}`, LOOKUP_MAX_PER_MIN, 60_000)
  if (!rl.ok) {
    return NextResponse.json({ success: false, error: 'Demasiadas consultas' }, { status: 429 })
  }

  const phone     = new URL(request.url).searchParams.get('phone')
  const phoneNorm = normalizePhone(phone)

  // Not a valid phone → nothing to look up (respond "not found", don't 400).
  if (!phoneNorm) {
    return NextResponse.json({ success: true, data: { found: false } })
  }

  try {
    const client = await prisma.client.findUnique({
      where:  { phoneNormalized: phoneNorm },
      select: { name: true },
    })
    return NextResponse.json({ success: true, data: { found: !!client, name: client?.name ?? null } })
  } catch (err) {
    if (isDbUnavailable(err)) return dbUnavailableResponse()
    console.error('Error en lookup de cliente:', err)
    // Fail safe: on error, behave as "not found" so the booking form still works.
    return NextResponse.json({ success: true, data: { found: false } })
  }
}
