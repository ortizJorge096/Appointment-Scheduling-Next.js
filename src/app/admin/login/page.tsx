'use client'
// src/app/admin/login/page.tsx
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
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

      {/* Decoración */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-[600px] h-[600px] rounded-full opacity-5"
          style={{ background: 'radial-gradient(circle, #C9A84C 0%, transparent 70%)' }} />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-10">
          <p className="font-serif text-3xl text-white font-light tracking-wide">
            Valentina Jimenez
          </p>
          <p className="text-gold text-sm italic font-light mt-0.5">Beauty Studio</p>
          <p className="text-white/20 text-xs mt-3 tracking-widest uppercase">Panel de administración</p>
        </div>

        {/* Separador dorado */}
        <div className="flex items-center gap-3 mb-8">
          <div className="flex-1 h-px bg-white/10" />
          <div className="w-1.5 h-1.5 bg-gold rotate-45" />
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Card */}
        <div className="border border-white/10 p-8">
          {error && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm px-4 py-3 mb-5">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-white/30 uppercase tracking-widest mb-2">Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                required autoComplete="email" className="input-dark"
                placeholder="admin@vjbeautystudio.com" />
            </div>
            <div>
              <label className="block text-xs text-white/30 uppercase tracking-widest mb-2">Contraseña</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                required autoComplete="current-password" className="input-dark"
                placeholder="••••••••" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-gold text-ink py-3 text-xs font-medium
                         tracking-widest uppercase mt-2 transition-all duration-200
                         hover:bg-gold-dark disabled:opacity-60">
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>

        <p className="text-center mt-6">
          <a href="/" className="text-xs text-white/20 hover:text-white/50 transition-colors">
            ← Volver al sitio
          </a>
        </p>
      </div>
    </main>
  )
}
