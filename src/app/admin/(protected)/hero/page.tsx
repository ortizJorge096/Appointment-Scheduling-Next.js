'use client'
// src/app/admin/(protected)/hero/page.tsx
// Hero banner management: upload, reorder, replace, set focal point, hide, delete.
// These are the homepage carousel images (S3 + DB), so they change without a
// rebuild. Distinct from the gallery (portfolio grid) — no titles/categories.

import { useState, useEffect, useRef } from 'react'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { usePermissionGuard, useCan } from '@/components/admin/usePermissionGuard'

interface HeroImage {
  id: string
  order: number
  isActive: boolean
  focalPoint: string
  url: string
  s3Key?: string
}

const MAX_BYTES = 5 * 1024 * 1024  // 5 MB

// 3×3 focal-point grid (matches FOCAL_POINTS in validations). The hero crops hard
// to a landscape banner, so choosing where it centers matters more than in the grid.
const FOCAL_OPTIONS: { value: string; label: string }[] = [
  { value: 'top left',      label: 'Arriba izq.' },
  { value: 'top center',    label: 'Arriba'      },
  { value: 'top right',     label: 'Arriba der.' },
  { value: 'center left',   label: 'Izquierda'   },
  { value: 'center center', label: 'Centro'      },
  { value: 'center right',  label: 'Derecha'     },
  { value: 'bottom left',   label: 'Abajo izq.'  },
  { value: 'bottom center', label: 'Abajo'       },
  { value: 'bottom right',  label: 'Abajo der.'  },
]

export default function HeroAdminPage() {
  usePermissionGuard('galeria:ver')
  const confirm = useConfirm()
  const can = useCan()
  const fileInputRef    = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)
  const replacingImgRef = useRef<HeroImage | null>(null)

  const [images, setImages]       = useState<HeroImage[]>([])
  const [loading, setLoading]     = useState(true)
  const [uploading, setUploading] = useState(false)
  const [replacingId, setReplacingId] = useState<string | null>(null)
  const [progress, setProgress]   = useState(0)
  const [error, setError]         = useState<string | null>(null)
  const [success, setSuccess]     = useState<string | null>(null)
  const [focalEditing, setFocalEditing] = useState<string | null>(null)

  function load() {
    setLoading(true)
    fetch('/api/hero?includeInactive=true')
      .then((r) => r.json())
      .then((j) => { if (j.success) setImages(j.data) })
      .catch(() => setError('Error al cargar el hero'))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  function flashSuccess(msg: string) {
    setSuccess(msg)
    setTimeout(() => setSuccess(null), 3000)
  }

  function validImage(file: File): boolean {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Solo se permiten JPG, PNG o WebP'); return false
    }
    if (file.size > MAX_BYTES) { setError('La imagen supera los 5 MB'); return false }
    return true
  }

  // Presigned PUT to S3, with progress. Returns the stored key.
  async function uploadToS3(file: File): Promise<string> {
    const r1 = await fetch('/api/hero/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, contentType: file.type }),
    })
    const j1 = await r1.json()
    if (!j1.success) throw new Error(j1.error ?? 'No se pudo iniciar la subida')
    await new Promise<void>((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      xhr.open('PUT', j1.data.uploadUrl)
      xhr.setRequestHeader('Content-Type', file.type)
      xhr.upload.onprogress = (e) => { if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100)) }
      xhr.onload  = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`S3 PUT ${xhr.status}`))
      xhr.onerror = () => reject(new Error('Error de red al subir a S3'))
      xhr.send(file)
    })
    return j1.data.key
  }

  async function handleFile(file: File) {
    setError(null)
    if (!validImage(file)) return
    setUploading(true); setProgress(0)
    try {
      const key = await uploadToS3(file)
      const r2 = await fetch('/api/hero', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ s3Key: key }),
      })
      const j2 = await r2.json()
      if (!j2.success) { setError(j2.error ?? 'Subió pero no se pudo registrar'); return }
      flashSuccess('Imagen agregada al hero')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al subir')
    } finally {
      setUploading(false); setProgress(0)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function replaceImage(img: HeroImage, file: File) {
    setError(null)
    if (!validImage(file)) return
    setReplacingId(img.id); setProgress(0)
    try {
      const key = await uploadToS3(file)
      const r2 = await fetch(`/api/hero/${img.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ s3Key: key }),
      })
      const j2 = await r2.json()
      if (!j2.success) { setError(j2.error ?? 'Imagen subida pero no actualizada'); return }
      flashSuccess('Imagen reemplazada')
      load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al reemplazar')
    } finally {
      setReplacingId(null); setProgress(0)
      if (replaceInputRef.current) replaceInputRef.current.value = ''
    }
  }

  async function setFocal(img: HeroImage, focalPoint: string) {
    // Optimistic: reflect the crop immediately, then persist.
    setImages((prev) => prev.map((i) => (i.id === img.id ? { ...i, focalPoint } : i)))
    const r = await fetch(`/api/hero/${img.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ focalPoint }),
    })
    if (!(await r.json()).success) { setError('No se pudo guardar el punto focal'); load() }
  }

  async function toggleActive(img: HeroImage) {
    const r = await fetch(`/api/hero/${img.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !img.isActive }),
    })
    if ((await r.json()).success) { flashSuccess(img.isActive ? 'Imagen ocultada' : 'Imagen activada'); load() }
    else setError('No se pudo actualizar')
  }

  async function deleteImage(img: HeroImage) {
    const ok = await confirm({
      message: 'Vas a eliminar esta imagen del hero definitivamente. Esta acción no se puede deshacer.',
      confirmLabel: 'Eliminar imagen', danger: true,
    })
    if (!ok) return
    const r = await fetch(`/api/hero/${img.id}`, { method: 'DELETE' })
    if ((await r.json()).success) { flashSuccess('Imagen eliminada'); load() }
  }

  async function move(img: HeroImage, direction: -1 | 1) {
    const sorted = [...images].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex((i) => i.id === img.id)
    const swapWith = sorted[idx + direction]
    if (!swapWith) return
    await Promise.all([
      fetch(`/api/hero/${img.id}`,      { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: swapWith.order }) }),
      fetch(`/api/hero/${swapWith.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order: img.order }) }),
    ])
    load()
  }

  const sorted = [...images].sort((a, b) => a.order - b.order)
  const readOnly = !can('galeria:editar')

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="mb-2 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-ink-muted-deep tracking-widest uppercase mb-1">Contenido</p>
          <h1 className="font-serif text-2xl sm:text-3xl text-ink font-light">Hero (portada)</h1>
        </div>
        {!readOnly && (
          <label aria-busy={uploading || undefined}
            className={`btn-primary cursor-pointer ${uploading ? 'opacity-70 pointer-events-none' : ''}`}>
            {uploading ? `Subiendo ${progress}%` : '+ Subir imagen'}
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              disabled={uploading} onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
            <input ref={replaceInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                const img = replacingImgRef.current
                if (file && img) { replacingImgRef.current = null; replaceImage(img, file) }
              }} />
          </label>
        )}
      </div>
      <p className="text-sm text-ink-muted-deep mb-6">
        Las imágenes del carrusel de la portada. Se aplican al sitio en unos segundos, sin recompilar. Recomendado 3–6 fotos apaisadas.
      </p>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 mb-5">⚠ {error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 mb-5">✓ {success}</div>}

      {loading ? (
        <p className="text-ink-muted-deep text-sm py-10 text-center">Cargando...</p>
      ) : images.length === 0 ? (
        <div className="border border-dashed border-beige-dark p-12 text-center bg-white">
          <p className="text-ink-muted-deep text-sm">Aún no hay imágenes de portada. Sube la primera con el botón de arriba.</p>
          <p className="text-ink-muted-deep text-xs mt-2">Mientras no haya ninguna, se usan las imágenes que trae el sitio por defecto.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((img, idx) => (
            <article key={img.id}
              className={`bg-white border ${img.isActive ? 'border-beige-dark' : 'border-beige-dark opacity-60'} flex flex-col`}>
              <div className="relative w-full aspect-video bg-beige overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="" style={{ objectPosition: img.focalPoint ?? 'center center' }}
                  className="w-full h-full object-cover" />
                {focalEditing === img.id && (
                  <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 bg-ink/20">
                    {FOCAL_OPTIONS.map((o) => {
                      const active = img.focalPoint === o.value
                      return (
                        <button key={o.value} type="button" title={o.label} aria-label={o.label}
                          onClick={() => setFocal(img, o.value)}
                          className="flex items-center justify-center group/fp">
                          <span className={`w-3.5 h-3.5 rounded-full border transition-all ${
                            active ? 'bg-gold border-gold scale-110 shadow' : 'bg-black/30 border-white/70 group-hover/fp:bg-white/60'
                          }`} />
                        </button>
                      )
                    })}
                  </div>
                )}
                {!img.isActive && (
                  <span className="absolute top-2 left-2 text-2xs uppercase tracking-widest bg-ink/70 text-white px-2 py-0.5 rounded-full">Oculta</span>
                )}
              </div>

              {!readOnly && (
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button disabled={idx === 0} onClick={() => move(img, -1)}
                      className="btn-row-action text-xs text-ink-muted-deep hover:text-gold-deep disabled:opacity-20" aria-label="Subir">↑</button>
                    <button disabled={idx === sorted.length - 1} onClick={() => move(img, +1)}
                      className="btn-row-action text-xs text-ink-muted-deep hover:text-gold-deep disabled:opacity-20" aria-label="Bajar">↓</button>
                  </div>
                  <div className="flex items-center gap-2 sm:gap-3 text-xs">
                    <button onClick={() => { replacingImgRef.current = img; replaceInputRef.current?.click() }}
                      disabled={replacingId === img.id} aria-label="Reemplazar imagen"
                      className="btn-row-action text-ink-muted-deep hover:text-gold-deep disabled:opacity-40">
                      {replacingId === img.id ? `${progress}%` : '📷'}
                    </button>
                    <button onClick={() => setFocalEditing(focalEditing === img.id ? null : img.id)}
                      aria-label="Punto focal"
                      className={`btn-row-action ${focalEditing === img.id ? 'text-gold-deep' : 'text-ink-muted-deep hover:text-gold-deep'}`}>◎</button>
                    <button onClick={() => toggleActive(img)} aria-label={img.isActive ? 'Ocultar' : 'Activar'}
                      className={`btn-row-action ${img.isActive ? 'text-ink-muted-deep hover:text-red-700' : 'text-green-700 hover:text-green-700'}`}>
                      {img.isActive ? '👁' : '✓'}
                    </button>
                    <button onClick={() => deleteImage(img)} aria-label="Eliminar"
                      className="btn-row-action text-ink-muted-deep hover:text-red-700 border-l border-beige-dark pl-3 ml-1">🗑</button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
