'use client'
// src/app/admin/(protected)/galeria/page.tsx
// Gallery management: upload, list, edit title/category, reorder, delete.

import { useState, useEffect, useRef } from 'react'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { Pagination } from '@/components/admin/Pagination'
import { usePermissionGuard } from '@/components/admin/usePermissionGuard'

interface GalleryImage {
  id: string
  title: string | null
  description: string | null
  categoryId: string | null
  category: { id: string; name: string; slug: string } | null
  width: number | null
  height: number | null
  order: number
  isActive: boolean
  url: string
  s3Key?: string
}

interface Category {
  id: string
  name: string
}

const MAX_BYTES = 5 * 1024 * 1024  // 5 MB

export default function GaleriaAdminPage() {
  usePermissionGuard('galeria:ver')
  const confirm = useConfirm()
  const fileInputRef    = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const replacingImgRef = useRef<GalleryImage | null>(null)

  const [images, setImages]   = useState<GalleryImage[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage]       = useState(1)
  const [uploading, setUploading] = useState(false)
  const [replacingId, setReplacingId] = useState<string | null>(null)
  const [progress, setProgress]   = useState(0)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState<string | null>(null)

  // Inline editing state
  const [editing, setEditing] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ title: string; description: string; categoryId: string }>({ title: '', description: '', categoryId: '' })

  function load() {
    setLoading(true)
    Promise.all([
      fetch('/api/gallery?includeInactive=true').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
    ])
      .then(([galJson, catJson]) => {
        if (galJson.success) setImages(galJson.data)
        if (catJson.success) setCategories(catJson.data)
      })
      .catch(() => setError('Error al cargar la galería'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function flashSuccess(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  async function handleFile(file: File) {
    setError(null)
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Solo se permiten JPG, PNG o WebP'); return
    }
    if (file.size > MAX_BYTES) {
      setError('La imagen supera los 5 MB'); return
    }

    setUploading(true)
    setProgress(0)
    try {
      // 1. Request signed URL
      const r1 = await fetch('/api/gallery/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      })
      const j1 = await r1.json()
      if (!j1.success) { setError(j1.error ?? 'No se pudo iniciar la subida'); return }

      // 2. Direct PUT to S3, with progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', j1.data.uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 PUT ${xhr.status}`))
        xhr.onerror = () => reject(new Error('Error de red al subir a S3'))
        xhr.send(file)
      })

      // 3. Register in DB
      const r2 = await fetch('/api/gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ s3Key: j1.data.key }),
      })
      const j2 = await r2.json()
      if (!j2.success) { setError(j2.error ?? 'Subió pero no se pudo registrar'); return }

      flashSuccess('Imagen subida')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir')
    } finally {
      setUploading(false)
      setProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function replaceImage(img: GalleryImage, file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Solo se permiten JPG, PNG o WebP'); return
    }
    if (file.size > MAX_BYTES) {
      setError('La imagen supera los 5 MB'); return
    }
    setReplacingId(img.id)
    setProgress(0)
    setError(null)
    try {
      // 1. Signed URL for the new image
      const r1 = await fetch('/api/gallery/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      })
      const j1 = await r1.json()
      if (!j1.success) { setError(j1.error ?? 'No se pudo iniciar la subida'); return }

      // 2. Direct PUT to S3
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', j1.data.uploadUrl)
        xhr.setRequestHeader('Content-Type', file.type)
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100))
        }
        xhr.onload  = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 PUT ${xhr.status}`))
        xhr.onerror = () => reject(new Error('Error de red al subir a S3'))
        xhr.send(file)
      })

      // 3. Update DB with the new s3Key (the API deletes the old one from S3)
      const r2 = await fetch(`/api/gallery/${img.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ s3Key: j1.data.key }),
      })
      const j2 = await r2.json()
      if (!j2.success) { setError(j2.error ?? 'Imagen subida pero no actualizada en BD'); return }

      flashSuccess('Imagen reemplazada')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al reemplazar')
    } finally {
      setReplacingId(null)
      setProgress(0)
      if (replaceInputRef.current) replaceInputRef.current.value = ''
    }
  }

  async function saveEdit(id: string) {
    const r = await fetch(`/api/gallery/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editForm.title.trim() || null,
        description: editForm.description.trim() || null,
        categoryId: editForm.categoryId || null,
      }),
    })
    const j = await r.json()
    if (j.success) { setEditing(null); flashSuccess('Actualizado'); load() }
    else setError(j.error)
  }

  async function toggleActive(img: GalleryImage) {
    const r = await fetch(`/api/gallery/${img.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !img.isActive }),
    })
    const j = await r.json()
    if (j.success) {
      flashSuccess(img.isActive ? 'Imagen ocultada' : 'Imagen activada')
      load()
    } else {
      setError(j.error ?? 'No se pudo actualizar')
    }
  }

  async function deleteImage(img: GalleryImage) {
    const ok = await confirm({
      message: `Vas a eliminar "${img.title ?? 'esta imagen'}" definitivamente. Esta acción no se puede deshacer.`,
      confirmLabel: 'Eliminar imagen',
      danger: true,
    })
    if (!ok) return
    const r = await fetch(`/api/gallery/${img.id}`, { method: 'DELETE' })
    if ((await r.json()).success) { flashSuccess('Imagen eliminada'); load() }
  }

  async function move(img: GalleryImage, direction: -1 | 1) {
    const sorted = [...images].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex((i) => i.id === img.id)
    const swapWith = sorted[idx + direction]
    if (!swapWith) return
    await Promise.all([
      fetch(`/api/gallery/${img.id}`,      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: swapWith.order }) }),
      fetch(`/api/gallery/${swapWith.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: img.order      }) }),
    ])
    load()
  }

  const PAGE_SIZE = 12
  const sortedImages = [...images].sort((a, b) => a.order - b.order)
  const totalPages = Math.max(1, Math.ceil(sortedImages.length / PAGE_SIZE))
  const pageImages = sortedImages.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  // Keep the page in range when images are added/removed.
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-6 sm:mb-8 flex items-center justify-between">
        <div>
          <p className="text-xs text-ink-muted tracking-widest uppercase mb-1">Contenido</p>
          <h1 className="font-serif text-2xl sm:text-3xl text-ink font-light">Galería</h1>
        </div>
        <label className={`btn-primary cursor-pointer ${uploading ? 'opacity-70 pointer-events-none' : ''}`}>
          {uploading ? `Subiendo ${progress}%` : '+ Subir imagen'}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            disabled={uploading}
            onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
          />
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              const img = replacingImgRef.current
              if (file && img) { replacingImgRef.current = null; replaceImage(img, file) }
            }}
          />
        </label>
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 mb-5">⚠ {error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 mb-5">✓ {success}</div>}

      {loading ? (
        <p className="text-ink-muted text-sm py-10 text-center">Cargando...</p>
      ) : images.length === 0 ? (
        <div className="border border-dashed border-beige-dark p-12 text-center bg-white">
          <p className="text-ink-muted text-sm">Aún no hay imágenes. Sube la primera con el botón de arriba.</p>
          <p className="text-ink-muted/60 text-xs mt-2">JPG · PNG · WebP · hasta 5 MB</p>
        </div>
      ) : (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pageImages.map((img, i) => {
            const idx = (page - 1) * PAGE_SIZE + i
            return (
            <article key={img.id}
              className={`bg-white border ${img.isActive ? 'border-beige-dark' : 'border-beige-dark opacity-60'} flex flex-col`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt={img.title ?? ''}
                className="w-full aspect-square object-cover bg-beige" />

              <div className="p-4 flex-1 flex flex-col gap-2">
                {editing === img.id ? (
                  <>
                    <input className="input-field" placeholder="Título (opcional)"
                      value={editForm.title}
                      onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                    />
                    <textarea className="input-field resize-none" rows={2}
                      placeholder="Descripción corta (opcional)"
                      maxLength={300}
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    />
                    <select className="select-field"
                      value={editForm.categoryId}
                      onChange={(e) => setEditForm({ ...editForm, categoryId: e.target.value })}>
                      <option value="">— Sin categoría —</option>
                      {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => saveEdit(img.id)} className="btn-primary flex-1 text-xs py-2">Guardar</button>
                      <button onClick={() => setEditing(null)} className="btn-secondary text-xs py-2">Cancelar</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="font-medium text-ink text-sm truncate">
                      {img.title || <span className="italic text-ink-muted/60">Sin título</span>}
                    </p>
                    <p className="text-xs text-gold tracking-widest uppercase">
                      {img.category ? img.category.name : '—'}
                    </p>
                      <div className="flex items-center justify-between mt-2 pt-3 border-t border-beige-dark/60">
                        <div className="flex items-center gap-1">
                          <button disabled={idx === 0}
                            onClick={() => move(img, -1)}
                            className="btn-row-action text-xs text-ink-muted hover:text-gold disabled:opacity-20">↑</button>
                          <button disabled={idx === sortedImages.length - 1}
                            onClick={() => move(img, +1)}
                            className="btn-row-action text-xs text-ink-muted hover:text-gold disabled:opacity-20">↓</button>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3 text-xs">
                          <button
                            onClick={() => { replacingImgRef.current = img; replaceInputRef.current?.click() }}
                            disabled={replacingId === img.id}
                            className="btn-row-action text-ink-muted hover:text-gold disabled:opacity-40">
                            {replacingId === img.id ? `${progress}%` : '📷'}
                          </button>
                          <button onClick={() => { setEditing(img.id); setEditForm({ title: img.title ?? '', description: img.description ?? '', categoryId: img.categoryId ?? '' }) }}
                            className="btn-row-action text-ink-muted hover:text-gold">✏️</button>
                          <button onClick={() => toggleActive(img)}
                            className={`btn-row-action ${img.isActive ? 'text-ink-muted hover:text-red-500' : 'text-green-600 hover:text-green-700'}`}>
                            {img.isActive ? '👁' : '✓'}
                          </button>
                          <button onClick={() => deleteImage(img)}
                            className="btn-row-action text-ink-muted hover:text-red-500 border-l border-beige-dark pl-3 ml-1">🗑</button>
                        </div>
                      </div>
                  </>
                )}
              </div>
            </article>
            )
          })}
        </div>
        <Pagination page={page} totalPages={totalPages} onPage={setPage} />
        </>
      )}
    </div>
  )
}
