// src/lib/auth.ts
// Configuración de NextAuth.js — solo autenticación de admin
// valentinajimenez

import type { NextAuthOptions, User } from 'next-auth'
import type { JWT } from 'next-auth/jwt'
import CredentialsProvider from 'next-auth/providers/credentials'
import { prisma } from './prisma'
import bcrypt from 'bcryptjs'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Contraseña', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
        })

        if (!user) return null

        const passwordMatch = await bcrypt.compare(credentials.password, user.password)
        if (!passwordMatch) return null

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
    maxAge: 8 * 60 * 60, // 8 horas — jornada laboral
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

  pages: {
    signIn: '/admin/login',   // página de login personalizada
    error: '/admin/login',
  },

  secret: process.env.NEXTAUTH_SECRET,
}
