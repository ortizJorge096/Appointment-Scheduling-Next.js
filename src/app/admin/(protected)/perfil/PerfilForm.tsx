'use client'
// src/app/admin/(protected)/perfil/PerfilForm.tsx
// Self-service password change. On success it calls useSession().update() to
// refresh THIS device's token (keeps the current session valid) while other
// devices' tokens are invalidated by the new passwordChangedAt.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { PasswordInput } from '@/components/ui/PasswordInput'

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' }

export default function PerfilForm() {
  const { data: session, update } = useSession()
  const router = useRouter()
  const mustChange = !!(session?.user as { mustChangePassword?: boolean } | undefined)?.mustChangePassword
  const [form, setForm]       = useState(EMPTY)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState('')

  function field(k: keyof typeof EMPTY) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(''); setSuccess('')
    if (form.newPassword !== form.confirmPassword) { setError('Las contraseñas no coinciden'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/account/password', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const j = await res.json()
      if (!j.success) { setError(j.error ?? 'No se pudo cambiar la contraseña'); return }
      await update() // refresh the token: keeps this session valid + clears mustChangePassword
      if (mustChange) { router.replace('/admin'); return } // forced change done → into the panel
      setSuccess('Contraseña actualizada. Se cerró la sesión en otros dispositivos.')
      setForm(EMPTY)
    } catch {
      setError('No se pudo conectar. Intenta de nuevo.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} noValidate className="bg-white rounded-xl border border-beige-dark p-5 space-y-4">
      <h2 className="font-serif text-lg text-ink">Cambiar contraseña</h2>

      {mustChange && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2 rounded-lg">
          Por seguridad, debes cambiar tu contraseña antes de continuar.
        </div>
      )}

      <div>
        <label className="form-label">Contraseña actual</label>
        <PasswordInput value={form.currentPassword} onChange={field('currentPassword')}
          autoComplete="current-password" className="input-field w-full" />
      </div>
      <div>
        <label className="form-label">Nueva contraseña</label>
        <PasswordInput value={form.newPassword} onChange={field('newPassword')}
          autoComplete="new-password" className="input-field w-full" />
        <p className="text-[11px] text-ink-muted mt-1">Mínimo 8 caracteres, una mayúscula y un número.</p>
      </div>
      <div>
        <label className="form-label">Confirmar nueva contraseña</label>
        <PasswordInput value={form.confirmPassword} onChange={field('confirmPassword')}
          autoComplete="new-password" className="input-field w-full" />
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-3 py-2 rounded-lg">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-3 py-2 rounded-lg">{success}</div>}

      <button type="submit" disabled={saving} className="btn-primary w-full disabled:opacity-50">
        {saving ? 'Guardando…' : 'Cambiar contraseña'}
      </button>
    </form>
  )
}
