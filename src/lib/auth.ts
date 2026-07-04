// src/lib/auth.ts
// NextAuth.js configuration — admin authentication only
// valentinajimenez

import type { NextAuthOptions, User } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import { audit } from './audit'
import bcrypt from 'bcryptjs'

// NextAuth's `authorize` receives headers as a plain object, not a Headers instance.
function ipFromHeaders(headers?: Record<string, unknown>): string | undefined {
  const xff = headers?.['x-forwarded-for']
  return typeof xff === 'string' ? xff.split(',')[0].trim() : undefined
}

// ── Brute-force guard ─────────────────────────────────────────
// Max login attempts per IP within a window. In-memory (per pod); resets on
// restart — acceptable for a single-pod studio. Cleared on a successful login.
const loginAttempts = new Map<string, { count: number; resetAt: number }>()
const LOGIN_MAX_ATTEMPTS = 10
const LOGIN_WINDOW_MS = 15 * 60 * 1000 // 15 minutes
let lastLoginSweep = Date.now()

// A valid bcrypt hash (cost 10). Used only to equalize response time on the
// "user not found" path so login timing can't reveal which emails exist.
const DUMMY_HASH = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy'

// Evict expired entries so the map can't grow unbounded with one-off IPs that
// never return (in-memory, single pod — this keeps it from leaking over time).
function sweepLoginAttempts(now: number) {
  if (now - lastLoginSweep < LOGIN_WINDOW_MS) return
  lastLoginSweep = now
  for (const [ip, e] of loginAttempts) if (now > e.resetAt) loginAttempts.delete(ip)
}

function isLoginRateLimited(ip: string | undefined): boolean {
  if (!ip) return false
  const now = Date.now()
  sweepLoginAttempts(now)
  const entry = loginAttempts.get(ip)
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS })
    return false
  }
  if (entry.count >= LOGIN_MAX_ATTEMPTS) return true
  entry.count++
  return false
}
function uaFromHeaders(headers?: Record<string, unknown>): string | undefined {
  const ua = headers?.['user-agent']
  return typeof ua === 'string' ? ua : undefined
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials, req) {
        const ip = ipFromHeaders(req?.headers as Record<string, unknown> | undefined)
        const userAgent = uaFromHeaders(req?.headers as Record<string, unknown> | undefined)
        const attempted = credentials?.email?.toLowerCase()

        if (!credentials?.email || !credentials?.password) return null

        // Throttle brute-force attempts before hitting the DB.
        if (isLoginRateLimited(ip)) {
          audit({
            action: 'LOGIN_FAILED', entity: 'AUTH', entityId: attempted ?? 'unknown',
            actorType: 'SYSTEM', userEmail: attempted, ip, userAgent,
            description: `Acceso bloqueado temporalmente por demasiados intentos (${attempted})`,
          })
          return null
        }

        const user = await prisma.user.findUnique({ where: { email: attempted! } })

        if (!user) {
          // Equalize timing with the password-check path below so an attacker
          // can't enumerate valid emails by response time (anti user-enumeration).
          await bcrypt.compare(credentials.password, DUMMY_HASH)
          // Fire-and-forget; never store the attempted password.
          audit({
            action: 'LOGIN_FAILED', entity: 'AUTH', entityId: attempted ?? 'unknown',
            actorType: 'SYSTEM', userEmail: attempted, ip, userAgent,
            description: `Intento de acceso fallido para ${attempted} (usuario inexistente)`,
          })
          return null
        }

        const passwordMatch = await bcrypt.compare(credentials.password, user.password)
        if (!passwordMatch) {
          audit({
            action: 'LOGIN_FAILED', entity: 'AUTH', entityId: user.id,
            actorType: 'SYSTEM', userEmail: attempted, ip, userAgent,
            description: `Intento de acceso fallido para ${attempted} (contraseña incorrecta)`,
          })
          return null
        }

        // A deactivated admin can't sign in (checked after the password match so
        // account status isn't revealed without valid credentials).
        if (!user.isActive) {
          audit({
            action: 'LOGIN_FAILED', entity: 'AUTH', entityId: user.id,
            actorType: 'SYSTEM', userEmail: attempted, ip, userAgent,
            description: `Acceso denegado: cuenta desactivada (${attempted})`,
          })
          return null
        }

        // Successful login → clear this IP's attempt counter + stamp last login.
        if (ip) loginAttempts.delete(ip)
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
          .catch(() => { /* non-critical */ })

        audit({
          action: 'LOGIN', entity: 'AUTH', entityId: user.id,
          actorType: 'ADMIN', userEmail: user.email, ip, userAgent,
          description: `${user.name} inició sesión`,
        })

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          // Embedded in the JWT so a later password change invalidates old tokens.
          pwdAt: user.passwordChangedAt?.getTime() ?? 0,
          mustChangePassword: user.mustChangePassword,
        }
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours — work day
  },

  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        const t = token as JWT & { id: string; role: string; pwdAt: number; mustChangePassword?: boolean }
        t.id    = user.id
        t.role  = (user as User & { role: string }).role
        t.pwdAt = (user as User & { pwdAt?: number }).pwdAt ?? 0
        t.mustChangePassword = (user as User & { mustChangePassword?: boolean }).mustChangePassword ?? false
      } else if (trigger === 'update') {
        // The current device just changed its own password and called update():
        // refresh pwdAt (so THIS session stays valid) and mustChangePassword (so
        // the forced-change guard releases immediately after the change).
        const t = token as JWT & { id?: string; pwdAt?: number; mustChangePassword?: boolean }
        if (t.id) {
          const u = await prisma.user.findUnique({ where: { id: t.id }, select: { passwordChangedAt: true, mustChangePassword: true } })
          t.pwdAt = u?.passwordChangedAt?.getTime() ?? t.pwdAt ?? 0
          t.mustChangePassword = u?.mustChangePassword ?? false
        }
      }
      return token
    },
    // Re-validates the token against the DB on each request: a deactivated admin,
    // or one whose password changed after this token was issued, is signed out
    // (session.user cleared → layout/guards redirect to login). One PK lookup per
    // request — fine at this scale, and the only way to invalidate stateless JWTs
    // without a session store.
    async session({ session, token }) {
      const t = token as JWT & { id?: string; role?: string; pwdAt?: number; mustChangePassword?: boolean }
      if (!session.user || !t.id) return session
      try {
        const u = await prisma.user.findUnique({
          where:  { id: t.id },
          select: { isActive: true, role: true, passwordChangedAt: true, mustChangePassword: true },
        })
        const dbPwdAt = u?.passwordChangedAt?.getTime() ?? 0
        if (!u || !u.isActive || dbPwdAt > (t.pwdAt ?? 0)) {
          ;(session as { user?: unknown }).user = undefined
          return session
        }
        const s = session as unknown as { user: { id: string; role: string; mustChangePassword: boolean } }
        s.user.id   = t.id
        s.user.role = u.role
        s.user.mustChangePassword = u.mustChangePassword
      } catch {
        // DB blip → trust the token rather than logging everyone out.
        const s = session as unknown as { user: { id: string; role: string; mustChangePassword: boolean } }
        s.user.id   = t.id
        s.user.role = t.role ?? 'ADMIN'
        s.user.mustChangePassword = t.mustChangePassword ?? false
      }
      return session
    },
  },

  events: {
    async signOut({ token }) {
      const t = token as (typeof token) & { id?: string; email?: string }
      audit({
        action: 'LOGOUT', entity: 'AUTH', entityId: t?.id ?? 'unknown',
        actorType: 'ADMIN', userEmail: t?.email ?? undefined,
        description: 'Sesión de admin cerrada',
      })
    },
  },

  pages: {
    signIn: '/admin/login',   // custom login page
    error: '/admin/login',
  },

  secret: process.env.NEXTAUTH_SECRET,
}
