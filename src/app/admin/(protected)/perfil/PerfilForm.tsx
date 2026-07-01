'use client'
// src/app/admin/(protected)/perfil/PerfilForm.tsx
// Self-service password change. On success it calls useSession().update() to
// refresh THIS device's token (keeps the current session valid) while other
// devices' tokens are invalidated by the new passwordChangedAt.

import { useState } from 'react'
import { useSession } from 'next-auth/react'

const EMPTY = { currentPassword: '', newPassword: '', confirmPassword: '' }

export default function PerfilForm() {
  const { update } = useSession()
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
      await update() // keep the current session valid after passwordChangedAt bump
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

      <div>
        <label className="form-label">Contraseña actual</label>
        <input type="password" value={form.currentPassword} onChange={field('currentPassword')}
          autoComplete="current-password" className="input-field w-full" />
      </div>
      <div>
        <label className="form-label">Nueva contraseña</label>
        <input type="password" value={form.newPassword} onChange={field('newPassword')}
          autoComplete="new-password" className="input-field w-full" />
        <p className="text-[11px] text-ink-muted mt-1">Mínimo 8 caracteres, una mayúscula y un número.</p>
      </div>
      <div>
        <label className="form-label">Confirmar nueva contraseña</label>
        <input type="password" value={form.confirmPassword} onChange={field('confirmPassword')}
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
