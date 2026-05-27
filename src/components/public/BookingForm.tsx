'use client'
// src/components/public/BookingForm.tsx

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import DateTimePicker from './DateTimePicker'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

interface Service {
  id: string
  name: string
  description: string | null
  price: number
  durationMinutes: number
}

type FormStep = 'service' | 'datetime' | 'info' | 'confirm'

interface FormData {
  serviceId:   string
  date:        string
  startTime:   string
  clientName:  string
  clientEmail: string
  clientPhone: string
  notes:       string
}

interface FieldErrors {
  clientName?:  string
  clientEmail?: string
  clientPhone?: string
}

const STORAGE_KEY = 'vj_booking_client'

function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency', currency: 'COP', minimumFractionDigits: 0,
  }).format(price)
}

const STEPS: FormStep[]                     = ['service', 'datetime', 'info', 'confirm']
const STEP_LABELS: Record<FormStep, string> = {
  service: 'Servicio', datetime: 'Fecha y hora', info: 'Tus datos', confirm: 'Confirmar',
}

export default function BookingForm() {
  const router      = useRouter()
  const continueRef = useRef<HTMLButtonElement>(null)

  // mounted evita mismatch de hidratación SSR vs cliente
  const [mounted, setMounted]         = useState(false)
  const [hasSavedData, setHasSavedData] = useState(false)

  const [step, setStep]               = useState<FormStep>('service')
  const [services, setServices]       = useState<Service[]>([])
  const [loadingSvc, setLoadingSvc]   = useState(true)
  const [submitting, setSubmitting]   = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [stepError,   setStepError]   = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [attempted,   setAttempted]   = useState(false)

  const [form, setForm] = useState<FormData>({
    serviceId:   '',
    date:        format(new Date(), 'yyyy-MM-dd'),
    startTime:   '',
    clientName:  '',
    clientEmail: '',
    clientPhone: '',
    notes:       '',
  })

  // 1. Señalar que ya estamos en el cliente
  useEffect(() => { setMounted(true) }, [])

  // 2. Leer localStorage solo después de montar (nunca en SSR)
  useEffect(() => {
    if (!mounted) return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) return
      const { clientName = '', clientEmail = '', clientPhone = '' } = JSON.parse(saved)
      if (clientName || clientEmail || clientPhone) {
        setForm((prev) => ({ ...prev, clientName, clientEmail, clientPhone }))
        setHasSavedData(true)
      }
    } catch { /* localStorage no disponible */ }
  }, [mounted])

  // 3. Guardar datos del cliente al escribir
  useEffect(() => {
    if (!mounted) return
    if (!form.clientName && !form.clientEmail && !form.clientPhone) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        clientName:  form.clientName,
        clientEmail: form.clientEmail,
        clientPhone: form.clientPhone,
      }))
    } catch { /* ok */ }
  }, [mounted, form.clientName, form.clientEmail, form.clientPhone])

  // 4. Cargar catálogo de servicios
  useEffect(() => {
    fetch('/api/services')
      .then((r) => r.json())
      .then((json) => { if (json.success) setServices(json.data) })
      .catch(() => setSubmitError('No se pudieron cargar los servicios.'))
      .finally(() => setLoadingSvc(false))
  }, [])

  // Limpiar errores al cambiar de paso
  useEffect(() => {
    setStepError(null)
    setFieldErrors({})
    setAttempted(false)
  }, [step])

  const selectedService = services.find((s) => s.id === form.serviceId)

  function updateForm(field: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (field in fieldErrors) setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    setStepError(null)
  }

  function clearSavedData() {
    setForm((p) => ({ ...p, clientName: '', clientEmail: '', clientPhone: '' }))
    setHasSavedData(false)
    try { localStorage.removeItem(STORAGE_KEY) } catch { /* ok */ }
  }

  function selectService(id: string) {
    updateForm('serviceId', id)
    setStepError(null)
    setTimeout(() => {
      continueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 80)
  }

  function validate(): boolean {
    setAttempted(true)
    if (step === 'service') {
      if (!form.serviceId) { setStepError('Por favor selecciona un servicio para continuar.'); return false }
      return true
    }
    if (step === 'datetime') {
      if (!form.startTime) { setStepError('Por favor selecciona una hora disponible.'); return false }
      return true
    }
    if (step === 'info') {
      const errors: FieldErrors = {}
      if (form.clientName.trim().length < 2)
        errors.clientName = 'Ingresa tu nombre completo (mínimo 2 caracteres).'
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.clientEmail.trim()))
        errors.clientEmail = 'Ingresa un email válido (ej: correo@dominio.com).'
      if (form.clientPhone.trim().length < 7)
        errors.clientPhone = 'Ingresa un número de teléfono válido.'
      if (Object.keys(errors).length > 0) { setFieldErrors(errors); return false }
      return true
    }
    return true
  }

  function handleNext() {
    if (!validate()) return
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }

  function handlePrev() {
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
  }

  async function handleSubmit() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId:   form.serviceId,
          date:        form.date,
          startTime:   form.startTime,
          clientName:  form.clientName.trim(),
          clientEmail: form.clientEmail.toLowerCase().trim(),
          clientPhone: form.clientPhone.trim(),
          notes:       form.notes.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!json.success) { setSubmitError(json.error ?? 'Ocurrió un error. Intenta de nuevo.'); return }
      router.push(`/confirmacion?id=${json.data.id}`)
    } catch {
      setSubmitError('Error de conexión. Por favor intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  function inputClass(error?: string) {
    return `input-field ${error ? 'border-red-400 focus:border-red-400 bg-red-50/30' : ''}`
  }

  return (
    <div className="max-w-2xl mx-auto">

      {/* Indicador de pasos */}
      <div className="flex items-center mb-10">
        {STEPS.map((s, i) => {
          const current  = STEPS.indexOf(step)
          const isDone   = i < current
          const isActive = s === step
          return (
            <div key={s} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium border transition-all
                  ${isDone ? 'bg-gold border-gold text-white' : isActive ? 'bg-white border-gold text-gold' : 'bg-white border-beige-dark text-ink-muted'}`}>
                  {isDone ? '✓' : i + 1}
                </div>
                <span className={`text-[10px] mt-1 tracking-wide uppercase hidden sm:block ${isActive ? 'text-gold font-medium' : 'text-ink-muted'}`}>
                  {STEP_LABELS[s]}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-2 transition-colors ${isDone ? 'bg-gold' : 'bg-beige-dark'}`} />
              )}
            </div>
          )
        })}
      </div>

      {submitError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 mb-6">
          <span className="mt-0.5">⚠</span> {submitError}
        </div>
      )}

      {/* PASO 1 — Servicio */}
      {step === 'service' && (
        <div className="space-y-3 animate-fade-in">
          <div className="mb-6">
            <h2 className="font-serif text-2xl text-ink">¿Qué servicio deseas?</h2>
            <p className="text-sm text-ink-muted mt-1">Selecciona uno de los servicios disponibles. <span className="text-red-500">*</span></p>
          </div>
          {stepError && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-200 px-4 py-3">
              <span>⚠</span> {stepError}
            </div>
          )}
          {loadingSvc ? (
            <div className="space-y-3">{[1,2,3].map((n) => <div key={n} className="h-20 bg-beige-dark animate-pulse" />)}</div>
          ) : (
            services.map((svc) => {
              const isSelected = form.serviceId === svc.id
              return (
                <button key={svc.id} type="button" onClick={() => selectService(svc.id)}
                  className={`w-full text-left p-5 border transition-all duration-150
                    ${isSelected ? 'border-gold bg-gold-pale ring-1 ring-gold'
                    : attempted && !form.serviceId ? 'border-red-300 bg-white hover:border-gold/50'
                    : 'border-beige-dark bg-white hover:border-gold/50'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                        ${isSelected ? 'border-gold' : 'border-beige-deeper'}`}>
                        {isSelected && <div className="w-2 h-2 rounded-full bg-gold" />}
                      </div>
                      <div>
                        <p className="font-medium text-ink">{svc.name}</p>
                        {svc.description && <p className="text-sm text-ink-muted mt-0.5">{svc.description}</p>}
                      </div>
                    </div>
                    <div className="text-right ml-4 shrink-0">
                      <p className="text-gold font-medium">{formatPrice(svc.price)}</p>
                      <p className="text-xs text-ink-muted">{svc.durationMinutes} min</p>
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}

      {/* PASO 2 — Fecha y hora */}
      {step === 'datetime' && (
        <div className="animate-fade-in">
          <div className="mb-6">
            <h2 className="font-serif text-2xl text-ink">Elige fecha y hora</h2>
            <p className="text-sm text-ink-muted mt-1">Selecciona el día y un horario disponible. <span className="text-red-500">*</span></p>
          </div>
          {stepError && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-200 px-4 py-3 mb-4">
              <span>⚠</span> {stepError}
            </div>
          )}
          <DateTimePicker
            serviceId={form.serviceId}
            selectedDate={form.date}
            selectedTime={form.startTime}
            onDateChange={(d) => updateForm('date', d)}
            onTimeChange={(t) => { updateForm('startTime', t); setStepError(null) }}
          />
        </div>
      )}

      {/* PASO 3 — Datos */}
      {step === 'info' && (
        <div className="animate-fade-in space-y-5">
          <div className="mb-2">
            <h2 className="font-serif text-2xl text-ink">Tus datos</h2>
            <p className="text-sm text-ink-muted mt-1">
              Los campos marcados con <span className="text-red-500 font-medium">*</span> son obligatorios.
            </p>
          </div>

          {/* Banner datos recordados — solo tras montar en cliente */}
          {mounted && hasSavedData && (
            <div className="flex items-center justify-between bg-gold-pale border border-gold/30 px-4 py-2.5 text-xs text-ink-mid">
              <span>✦ Datos cargados de tu visita anterior</span>
              <button type="button" onClick={clearSavedData}
                className="text-ink-muted hover:text-red-500 transition-colors underline">
                Borrar
              </button>
            </div>
          )}

          <div>
            <label className="form-label">Nombre completo <span className="text-red-500">*</span></label>
            <input type="text" className={inputClass(fieldErrors.clientName)}
              placeholder="Tu nombre y apellido" value={form.clientName}
              onChange={(e) => updateForm('clientName', e.target.value)} autoComplete="name" />
            {fieldErrors.clientName && (
              <p className="flex items-center gap-1.5 text-red-500 text-xs mt-1.5"><span>⚠</span> {fieldErrors.clientName}</p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Email <span className="text-red-500">*</span></label>
              <input type="email" className={inputClass(fieldErrors.clientEmail)}
                placeholder="tu@email.com" value={form.clientEmail}
                onChange={(e) => updateForm('clientEmail', e.target.value)} autoComplete="email" />
              {fieldErrors.clientEmail && (
                <p className="flex items-center gap-1.5 text-red-500 text-xs mt-1.5"><span>⚠</span> {fieldErrors.clientEmail}</p>
              )}
            </div>
            <div>
              <label className="form-label">Teléfono / WhatsApp <span className="text-red-500">*</span></label>
              <input type="tel" className={inputClass(fieldErrors.clientPhone)}
                placeholder="300 000 0000" value={form.clientPhone}
                onChange={(e) => updateForm('clientPhone', e.target.value)} autoComplete="tel" />
              {fieldErrors.clientPhone && (
                <p className="flex items-center gap-1.5 text-red-500 text-xs mt-1.5"><span>⚠</span> {fieldErrors.clientPhone}</p>
              )}
            </div>
          </div>

          <div>
            <label className="form-label">
              Notas adicionales{' '}
              <span className="text-ink-muted/60 normal-case font-normal tracking-normal">(opcional)</span>
            </label>
            <textarea className="input-field resize-none" rows={3}
              placeholder="Ej: prefiero esmalte nude, tengo uñas acrílicas previas..."
              value={form.notes} onChange={(e) => updateForm('notes', e.target.value)} maxLength={500} />
            <p className="text-xs text-ink-muted/50 mt-1 text-right">{form.notes.length}/500</p>
          </div>
        </div>
      )}

      {/* PASO 4 — Confirmar */}
      {step === 'confirm' && selectedService && (
        <div className="animate-fade-in">
          <div className="mb-6">
            <h2 className="font-serif text-2xl text-ink">Confirma tu cita</h2>
            <p className="text-sm text-ink-muted mt-1">Revisa los datos antes de confirmar.</p>
          </div>
          <div className="bg-beige border border-beige-dark p-6 space-y-3 mb-6">
            {[
              { label: 'Servicio',  value: selectedService.name },
              { label: 'Fecha',     value: format(new Date(`${form.date}T12:00:00`), "EEEE d 'de' MMMM", { locale: es }) },
              { label: 'Hora',      value: form.startTime },
              { label: 'Duración',  value: `${selectedService.durationMinutes} minutos` },
              { label: 'Valor',     value: formatPrice(selectedService.price) },
              { label: 'Nombre',    value: form.clientName },
              { label: 'Email',     value: form.clientEmail },
              { label: 'Teléfono', value: form.clientPhone },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-sm border-b border-beige-dark pb-3 last:border-0 last:pb-0">
                <span className="text-ink-muted">{label}</span>
                <span className="text-ink font-medium text-right max-w-[60%] capitalize">{value}</span>
              </div>
            ))}
          </div>
          {form.notes && (
            <div className="text-sm text-ink-muted bg-white border border-beige-dark p-4 mb-6">
              <span className="font-medium text-ink">Notas: </span>{form.notes}
            </div>
          )}
          <p className="text-xs text-ink-muted leading-relaxed mb-6">
            Recibirás un <strong className="text-ink">email de confirmación</strong> de inmediato.
            Si necesitas cancelar, hazlo con al menos 24 horas de anticipación.
          </p>
        </div>
      )}

      {/* Navegación */}
      <div className="flex justify-between mt-10 pt-6 border-t border-beige-dark">
        {step !== 'service' ? (
          <button type="button" onClick={handlePrev} className="btn-secondary" disabled={submitting}>← Atrás</button>
        ) : <span />}
        {step !== 'confirm' ? (
          <button ref={continueRef} type="button" onClick={handleNext} className="btn-primary">Continuar →</button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={submitting} className="btn-primary disabled:opacity-70">
            {submitting ? 'Confirmando...' : 'Confirmar cita'}
          </button>
        )}
      </div>

    </div>
  )
}
