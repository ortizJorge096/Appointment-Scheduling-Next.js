'use client'
// src/app/admin/login/LoginForm.tsx
// Credentials form. The session check lives in page.tsx (server) so an already
// signed-in admin never sees this render — same server-page + client-form split
// the rest of the admin uses.

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { SubmitButton } from '@/components/ui/SubmitButton'

export default function LoginForm() {
  const router = useRouter()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null)
    const result = await signIn('credentials', { email, password, redirect: false })
    if (result?.error) { setError('Email o contraseña incorrectos.'); setLoading(false); return }
    router.push('/admin')
    router.refresh()
  }

  return (
    <main className="min-h-screen bg-ink flex items-center justify-center px-6">

      {/* Decoration */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-[600px] h-[600px] rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, var(--gold-light) 0%, transparent 70%)' }} />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <p className="logo-script text-gold text-4xl leading-none">
            Valentina Jimenez
          </p>
          <p className="logo-studio text-white/70 text-[0.6rem] mt-1">Beauty Studio</p>
          <p className="text-white/50 text-xs mt-3 tracking-widest uppercase">Panel de administración</p>
        </div>

        {/* Gold separator */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex-1 h-px bg-white/10" />
          <div className="w-1.5 h-1.5 bg-gold rotate-45" aria-hidden="true" />
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Card */}
        <div className="border border-white/10 p-8">
          {error && (
            <div role="alert" className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs text-white/55 uppercase tracking-widest mb-2">Email</label>
              <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required autoComplete="email" className="input-dark"
                placeholder="admin@vjbeautystudio.com" />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs text-white/55 uppercase tracking-widest mb-2">Contraseña</label>
              <PasswordInput id="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required autoComplete="current-password" className="input-dark"
                iconClassName="text-white/55 hover:text-white/90"
                placeholder="••••••••" />
            </div>
            {/* hover lifts to gold-light: darkening to gold-dark would drop the
                ink label to 3.8:1, the same trap .btn-primary fell into. */}
            <SubmitButton type="submit" loading={loading} loadingLabel="Ingresando…"
              className="w-full bg-gold text-ink py-3 text-xs font-medium
                         tracking-widest uppercase mt-2 transition-all duration-200
                         hover:bg-gold-light disabled:opacity-60
                         focus-visible:outline-none focus-visible:ring-2
                         focus-visible:ring-gold focus-visible:ring-offset-2
                         focus-visible:ring-offset-ink">
              Ingresar
            </SubmitButton>
          </form>
        </div>

        <p className="text-center mt-6">
          <Link href="/" className="text-xs text-white/55 hover:text-white/80 transition-colors">
            ← Volver al sitio
          </Link>
        </p>
      </div>
    </main>
  )
}
