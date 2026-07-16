'use client'
// src/app/admin/(protected)/usuarios/UsuariosClient.tsx
// SUPER_ADMIN admin management: list + create/edit/reset-password/deactivate/delete.
// All mutations go through /api/users(/[id]); the server enforces the guard rails
// (no self-deactivate, never orphan the last SUPER_ADMIN, preserve audit history).

import { useState } from 'react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ROLES, ROLE_LABELS, ROLE_DESCRIPTIONS, roleCapabilities, type Role } from '@/lib/permissions'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { useToast } from '@/components/ui/Toast'
import { PasswordInput } from '@/components/ui/PasswordInput'
import { Modal } from '@/components/ui/Modal'
import { SubmitButton } from '@/components/ui/SubmitButton'

interface AdminRow {
  id: string
  name: string
  email: string
  role: Role
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
}

const ROLE_LABEL = ROLE_LABELS

type ModalState =
  | null
  | { mode: 'create' }
  | { mode: 'edit'; user: AdminRow }

const EMPTY_FORM = { name: '', email: '', password: '', role: 'ADMIN' as Role, newPassword: '' }

export default function UsuariosClient({
  initialUsers, currentAdminId,
}: {
  initialUsers: AdminRow[]
  currentAdminId: string
}) {
  const [users, setUsers] = useState<AdminRow[]>(initialUsers)
  const [error, setError] = useState('')
  const [modal, setModal] = useState<ModalState>(null)
  const [form, setForm]   = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [showPerms, setShowPerms] = useState(false)
  const confirm = useConfirm()
  const toast = useToast()

  async function reload() {
    const res = await fetch('/api/users')
    const j = await res.json()
    if (j.success) setUsers(j.data)
  }

  function openCreate() {
    setForm(EMPTY_FORM); setError(''); setShowPerms(false); setModal({ mode: 'create' })
  }
  function openEdit(user: AdminRow) {
    setForm({ name: user.name, email: user.email, password: '', role: user.role, newPassword: '' })
    setError(''); setShowPerms(false); setModal({ mode: 'edit', user })
  }

  async function submitModal(e: React.FormEvent) {
    e.preventDefault()
    if (!modal) return
    setSaving(true); setError('')
    try {
      if (modal.mode === 'create') {
        const res = await fetch('/api/users', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name, email: form.email, password: form.password, role: form.role }),
        })
        const j = await res.json()
        if (!j.success) { setError(j.error ?? 'No se pudo crear'); return }
      } else {
        const body: Record<string, unknown> = { name: form.name, email: form.email, role: form.role }
        if (form.newPassword) body.newPassword = form.newPassword
        const res = await fetch(`/api/users/${modal.user.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
        const j = await res.json()
        if (!j.success) { setError(j.error ?? 'No se pudo actualizar'); return }
      }
      setModal(null)
      await reload()
      toast.success(modal.mode === 'create' ? 'Admin creado' : 'Cambios guardados')
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(u: AdminRow) {
    setError('')
    const res = await fetch(`/api/users/${u.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !u.isActive }),
    })
    const j = await res.json()
    if (!j.success) { setError(j.error ?? 'No se pudo cambiar el estado'); return }
    await reload()
    toast.success(u.isActive ? `${u.name} desactivado` : `${u.name} activado`)
  }

  async function remove(u: AdminRow) {
    const ok = await confirm({
      message: `¿Eliminar a ${u.name}? Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar',
      danger: true,
    })
    if (!ok) return
    setError('')
    const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' })
    const j = await res.json()
    if (!j.success) { setError(j.error ?? 'No se pudo eliminar'); return }
    await reload()
    toast.success('Admin eliminado')
  }

  return (
    <>
      <div className="flex justify-end mb-4">
        <button onClick={openCreate} className="btn-primary text-sm">+ Nuevo admin</button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg mb-4">{error}</div>
      )}

      {/* Desktop: table (hidden on mobile — the action table is unusable at <640px) */}
      <div className="bg-white rounded-xl border border-beige-dark overflow-x-auto hidden sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-beige-dark bg-beige text-xs text-ink-muted-deep uppercase tracking-widest">
              <th className="text-left px-5 py-3 font-medium">Nombre</th>
              <th className="text-left px-5 py-3 font-medium">Email</th>
              <th className="text-left px-5 py-3 font-medium">Rol</th>
              <th className="text-left px-5 py-3 font-medium">Estado</th>
              <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Último acceso</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-beige-dark">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-beige transition-colors">
                <td className="px-5 py-3.5 text-ink font-medium">
                  {u.name}{u.id === currentAdminId && <span className="text-2xs text-ink-muted-deep ml-1">(tú)</span>}
                </td>
                <td className="px-5 py-3.5 text-ink-muted-deep">{u.email}</td>
                <td className="px-5 py-3.5">
                  <span className={`text-2xs tracking-wide uppercase px-2 py-0.5 rounded-full border ${
                    u.role === 'SUPER_ADMIN' ? 'bg-gold-pale text-gold-deep border-gold/30' : 'bg-beige text-ink-muted-deep border-beige-dark'
                  }`}>{ROLE_LABEL[u.role]}</span>
                </td>
                <td className="px-5 py-3.5">
                  <span className={u.isActive ? 'text-green-700' : 'text-ink-muted-deep'}>
                    {u.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </td>
                <td className="px-5 py-3.5 text-ink-muted-deep text-xs whitespace-nowrap hidden sm:table-cell">
                  {u.lastLoginAt ? format(new Date(u.lastLoginAt), "d MMM yyyy · HH:mm", { locale: es }) : '—'}
                </td>
                <td className="px-5 py-3.5 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(u)} className="text-xs text-gold-deep hover:text-gold-dark transition-colors">Editar</button>
                  {u.id !== currentAdminId && (
                    <>
                      <button onClick={() => toggleActive(u)} className="text-xs text-ink-muted-deep hover:text-gold-deep transition-colors ml-3">
                        {u.isActive ? 'Desactivar' : 'Activar'}
                      </button>
                      <button onClick={() => remove(u)} className="text-xs text-ink-muted-deep hover:text-red-700 transition-colors ml-3">Eliminar</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile: cards with comfortable (≥44px) action buttons */}
      <div className="sm:hidden space-y-3">
        {users.map((u) => (
          <div key={u.id} className="bg-white rounded-xl border border-beige-dark p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-ink font-medium">
                  {u.name}{u.id === currentAdminId && <span className="text-2xs text-ink-muted-deep ml-1">(tú)</span>}
                </p>
                <p className="text-xs text-ink-muted-deep truncate">{u.email}</p>
              </div>
              <span className={`shrink-0 text-2xs tracking-wide uppercase px-2 py-0.5 rounded-full border ${
                u.role === 'SUPER_ADMIN' ? 'bg-gold-pale text-gold-deep border-gold/30' : 'bg-beige text-ink-muted-deep border-beige-dark'
              }`}>{ROLE_LABEL[u.role]}</span>
            </div>
            <div className="flex items-center justify-between gap-2 mt-3">
              <span className={`text-sm ${u.isActive ? 'text-green-700' : 'text-ink-muted-deep'}`}>
                {u.isActive ? 'Activo' : 'Inactivo'}
              </span>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button onClick={() => openEdit(u)}
                  className="min-h-11 px-3 rounded-lg border border-beige-dark text-sm text-gold-dark">Editar</button>
                {u.id !== currentAdminId && (
                  <>
                    <button onClick={() => toggleActive(u)}
                      className="min-h-11 px-3 rounded-lg border border-beige-dark text-sm text-ink-muted-deep">
                      {u.isActive ? 'Desactivar' : 'Activar'}
                    </button>
                    <button onClick={() => remove(u)}
                      className="min-h-11 px-3 rounded-lg border border-red-200 text-sm text-red-700">Eliminar</button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Create / edit modal */}
      {modal && (
        <Modal open onClose={() => setModal(null)}
          title={modal.mode === 'create' ? 'Nuevo admin' : 'Editar admin'}>
            <form onSubmit={submitModal} noValidate className="px-6 py-5 space-y-4">
              <div>
                <label className="form-label">Nombre</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="input-field w-full" />
              </div>
              <div>
                <label className="form-label">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="input-field w-full" />
              </div>
              <div>
                <label className="form-label">Rol</label>
                <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as Role }))}
                  className="input-field w-full bg-white">
                  {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
                {/* What this role can do — derived from permissions.ts */}
                <div className="mt-2 text-xs text-ink-muted-deep bg-beige-pale border border-beige-dark rounded-lg p-2.5">
                  <p>{ROLE_DESCRIPTIONS[form.role]}</p>
                  <button type="button" onClick={() => setShowPerms((v) => !v)}
                    className="text-gold-deep hover:underline mt-1">
                    {showPerms ? 'Ocultar permisos' : 'Ver qué puede hacer'}
                  </button>
                  {showPerms && (
                    <ul className="mt-1.5 space-y-0.5">
                      {roleCapabilities(form.role).map((c) => (
                        <li key={c.area}><span className="text-ink font-medium">{c.area}</span> · {c.actions.join(', ')}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
              {modal.mode === 'create' ? (
                <div>
                  <label className="form-label">Contraseña temporal</label>
                  <PasswordInput value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                    autoComplete="new-password" className="input-field w-full" />
                  <p className="text-2xs text-ink-muted-deep mt-1">Mínimo 8 caracteres, una mayúscula y un número. Compártela con el admin.</p>
                </div>
              ) : (
                <div>
                  <label className="form-label">Restablecer contraseña <span className="text-ink-muted-deep normal-case font-normal tracking-normal">(opcional)</span></label>
                  <PasswordInput value={form.newPassword} onChange={(e) => setForm((f) => ({ ...f, newPassword: e.target.value }))}
                    autoComplete="new-password" placeholder="Dejar en blanco para no cambiarla" className="input-field w-full" />
                  <p className="text-2xs text-ink-muted-deep mt-1">Si la cambias, se cerrará la sesión de ese admin en todos sus dispositivos.</p>
                </div>
              )}

              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">{error}</div>}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setModal(null)} className="btn-secondary flex-1">Cancelar</button>
                <SubmitButton type="submit" loading={saving} loadingLabel="Guardando…" className="btn-primary flex-1 disabled:opacity-50">
                  {modal.mode === 'create' ? 'Crear admin' : 'Guardar cambios'}
                </SubmitButton>
              </div>
            </form>
        </Modal>
      )}
    </>
  )
}
