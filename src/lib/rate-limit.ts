// src/lib/rate-limit.ts
// Shared, cross-pod rate limiting backed by Postgres. The app runs with 2+
// replicas (deployment.yaml replicas: 2 + HPA), so a per-pod in-memory counter
// would multiply the effective limit and behave non-deterministically. A single
// atomic upsert keeps one fixed-window counter per key for the whole fleet.

import { prisma } from './prisma'

export interface RateLimitResult {
  /** true = request is within the window's limit. */
  ok: boolean
  /** attempts left in the current window (0 when blocked). */
  remaining: number
}

/**
 * Fixed-window rate limit. Atomic via a single INSERT … ON CONFLICT upsert, so
 * concurrent requests across pods share one counter. `resetAt` is computed in the
 * app and stored as a timestamp; the window-expiry check compares it against the
 * DB clock (skew between app and DB is negligible for an anti-abuse guard).
 *
 * Fail-open: on any DB error the request is allowed — the limit is a guard, not a
 * hard gate; never break bookings/logins because the limiter hiccuped.
 */
export async function rateLimit(key: string, max: number, windowMs: number): Promise<RateLimitResult> {
  const resetAt = new Date(Date.now() + windowMs)
  try {
    const rows = await prisma.$queryRaw<Array<{ count: number }>>`
      INSERT INTO rate_limits ("key", "count", "resetAt")
      VALUES (${key}, 1, ${resetAt})
      ON CONFLICT ("key") DO UPDATE SET
        "count"   = CASE WHEN rate_limits."resetAt" <= now() THEN 1 ELSE rate_limits."count" + 1 END,
        "resetAt" = CASE WHEN rate_limits."resetAt" <= now() THEN ${resetAt} ELSE rate_limits."resetAt" END
      RETURNING "count"
    `
    const count = Number(rows[0]?.count ?? 1)
    // Best-effort sweep so one-off keys (IPs that never return) don't accumulate.
    if (Math.random() < 0.02) {
      prisma.$executeRaw`DELETE FROM rate_limits WHERE "resetAt" <= now()`.catch(() => {})
    }
    return { ok: count <= max, remaining: Math.max(0, max - count) }
  } catch (err) {
    console.error('[rate-limit] fallo, permitiendo la petición (fail-open):', err)
    return { ok: true, remaining: max }
  }
}

/** Clears a key's counter (e.g. after a successful login). Never throws. */
export async function rateLimitReset(key: string): Promise<void> {
  try {
    await prisma.$executeRaw`DELETE FROM rate_limits WHERE "key" = ${key}`
  } catch (err) {
    console.error('[rate-limit] no se pudo limpiar el contador:', err)
  }
}
