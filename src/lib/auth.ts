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

        const user = await prisma.user.findUnique({ where: { email: attempted! } })

        if (!user) {
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
        }
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours — work day
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const t = token as JWT & { id: string; role: string }
        t.id = user.id
        t.role = (user as User & { role: string }).role
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        const s = session as unknown as { user: { id: string; role: string } }
        const t = token as JWT & { id: string; role: string }
        s.user.id = t.id
        s.user.role = t.role
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
