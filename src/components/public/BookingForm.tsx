'use client'
// src/components/public/BookingForm.tsx

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import DateTimePicker from './DateTimePicker'
import { Icon } from './ServiceIcons'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { formatPrice, isValidPhone } from '@/lib/utils'
import { trackBeginBooking, trackBookingConfirmed } from '@/lib/analytics'

interface Service {
  id: string
  name: string
  description: string | null
  categoryId: string | null
  price: number
  durationMinutes: number
}

interface Category {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string
  order: number
}

interface Professional {
  id: string
  name: string
  specialty: string | null
  rating: number
  reviewCount: number
}

type FormStep = 'service' | 'professional' | 'datetime' | 'confirm'

interface FormData {
  category:      string
  serviceId:     string
  serviceIds:    string[]
  professionalId: string // '' = "Primera disponible"
  date:          string
  startTime:     string
  clientName:    string
  clientEmail:   string
  clientPhone:   string
  notes:         string
}

// Pseudo-category: not a real Service.category in the DB. Selecting it
// unlocks multi-service selection across all real categories, with the
// tiered VIP discount. Every other service stays single-select.
const VIP_PSEUDO_CATEGORY = 'VIP'

const VIP_BLURB = 'Combina 2 o más servicios de cualquier categoría y ahorra hasta 30%'

interface VipTier { minServices: number; discountPct: number }
interface VipSettings { enabled: boolean; tiers: VipTier[] }

/** Mirrors src/lib/vip.ts#resolveDiscountPercent, without the Prisma import (client-safe). */
function resolveDiscountPercent(serviceCount: number, settings: VipSettings): number {
  if (!settings.enabled || serviceCount < 2) return 0
  const applicable = settings.tiers
    .filter((t) => serviceCount >= t.minServices)
    .sort((a, b) => b.minServices - a.minServices)[0]
  return applicable?.discountPct ?? 0
}

interface FieldErrors {
  clientName?:  string
  clientEmail?: string
  clientPhone?: string
}

const STORAGE_KEY = 'vj_booking_client'

const STEP_LABELS: Record<FormStep, string> = {
  service: 'Servicio', professional: 'Profesional', datetime: 'Fecha y hora', confirm: 'Confirmar',
}

export default function BookingForm() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const continueRef  = useRef<HTMLButtonElement>(null)
  const formTopRef   = useRef<HTMLDivElement>(null)
  const beganRef     = useRef(false) // GA begin_checkout fires once per visit

  // mounted prevents SSR vs client hydration mismatch
  const [mounted, setMounted]                 = useState(false)
  const [savedClientData, setSavedClientData] = useState({ clientName: '', clientEmail: '', clientPhone: '' })
  const [appliedPreselect, setAppliedPreselect] = useState(false)

  const [step, setStep]               = useState<FormStep>('service')
  const [services, setServices]       = useState<Service[]>([])
  const [categories, setCategories]   = useState<Category[]>([])
  const [loadingSvc, setLoadingSvc]   = useState(true)
  const [professionals, setProfessionals] = useState<Professional[]>([])
  const [loadingPro, setLoadingPro]   = useState(true)
  const [cupos, setCupos]             = useState<number | null>(null)
  const [vipSettings, setVipSettings] = useState<VipSettings>({ enabled: false, tiers: [] })
  // Admin toggle (/admin/profesionales): when off, the client never picks a
  // professional — the server already auto-assigns "primera disponible".
  const [showProfessionalStep, setShowProfessionalStep] = useState(false)
  const [maxAdvanceDays, setMaxAdvanceDays] = useState(90)
  const [submitting, setSubmitting]   = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [stepError,   setStepError]   = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [attempted,   setAttempted]   = useState(false)
  // Phone-first client recognition (consent-based autofill on the confirm step)
  const [lookup,          setLookup]          = useState<{ name: string } | null>(null)
  const [lookupDismissed, setLookupDismissed] = useState(false)

  const [form, setForm] = useState<FormData>({
    category:       '',
    serviceId:      '',
    serviceIds:     [],
    professionalId: '',
    date:           format(new Date(), 'yyyy-MM-dd'),
    startTime:      '',
    clientName:     '',
    clientEmail:    '',
    clientPhone:    '',
    notes:          '',
  })

  // 1. Signal we are already on the client
  useEffect(() => { setMounted(true) }, [])

  // 1b. GA4: reaching the booking flow counts as starting checkout (once).
  useEffect(() => {
    if (beganRef.current) return
    beganRef.current = true
    trackBeginBooking()
  }, [])

  // 2. Read localStorage only after mounting (never in SSR).
  //    Data feeds the <datalist> of each field — they appear as
  //    dropdown suggestions on click, but the field starts empty.
  useEffect(() => {
    if (!mounted) return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (!saved) return
      const data = JSON.parse(saved)
      setSavedClientData({
        clientName:  data.clientName  || '',
        clientEmail: data.clientEmail || '',
        clientPhone: data.clientPhone || '',
      })
    } catch { /* localStorage not available */ }
  }, [mounted])

  // 3. Persist client data to localStorage on write
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

  // 4. Load the service catalog, the VIP discount settings, the active
  //    professionals, and today's remaining-slots count (scarcity badge)
  useEffect(() => {
    fetch('/api/services')
      .then((r) => r.json())
      .then((json) => { if (json.success) setServices(json.data) })
      .catch(() => setSubmitError('No se pudieron cargar los servicios.'))
      .finally(() => setLoadingSvc(false))

    fetch('/api/categories')
      .then((r) => r.json())
      .then((json) => { if (json.success) setCategories(json.data) })
      .catch(() => {})

    fetch('/api/vip-config')
      .then((r) => r.json())
      .then((json) => { if (json.success) setVipSettings(json.data) })
      .catch(() => {})

    fetch('/api/professionals')
      .then((r) => r.json())
      .then((json) => { if (json.success) setProfessionals(json.data) })
      .catch(() => {})
      .finally(() => setLoadingPro(false))

    fetch('/api/availability/today')
      .then((r) => r.json())
      .then((json) => { if (json.success) setCupos(json.data.remaining) })
      .catch(() => {})

    fetch('/api/booking-settings')
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setShowProfessionalStep(json.data.showProfessionalStep)
          if (typeof json.data.maxAdvanceDays === 'number') setMaxAdvanceDays(json.data.maxAdvanceDays)
        }
      })
      .catch(() => {})
  }, [])

  // 5. Pre-selection via URL: /agendar?service=ID or /agendar?categoria=UNAS
  useEffect(() => {
    if (appliedPreselect || services.length === 0) return

    const preService = searchParams.get('service')
    if (preService) {
      const svc = services.find((s) => s.id === preService)
      if (svc) {
        setForm((prev) => ({ ...prev, category: svc.categoryId ?? '', serviceId: svc.id, serviceIds: [svc.id] }))
        setStep('datetime')
        setAppliedPreselect(true)
        return
      }
    }

    // ?categoria=<slug> — preselect the matching category by its stable slug
    const preCat = searchParams.get('categoria')
    if (preCat) {
      const cat = categories.find((c) => c.slug === preCat)
      if (cat) {
        setForm((prev) => ({ ...prev, category: cat.id }))
        setAppliedPreselect(true)
      }
    }
  }, [services, categories, searchParams, appliedPreselect])

  // 5b. VIP shortcut: /agendar?modo=vip lands directly on the multi-service
  // selection (all categories), skipping the category grid. Runs on mount (no
  // need to wait for services) so the category grid never flashes.
  useEffect(() => {
    if (appliedPreselect) return
    if (searchParams.get('modo') === 'vip') {
      setForm((prev) => ({ ...prev, category: VIP_PSEUDO_CATEGORY }))
      setAppliedPreselect(true)
    }
  }, [searchParams, appliedPreselect])

  // Clear errors and scroll to top when step changes
  useEffect(() => {
    setStepError(null)
    setFieldErrors({})
    setAttempted(false)
    setTimeout(() => {
      formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }, [step])

  // Phone-first recognition: when a valid, known phone is typed on the confirm
  // step, offer to autofill the returning client's name (with consent). The
  // lookup endpoint discloses only the name — never email/history — so numbers
  // can't be used to harvest data. Debounced + aborts stale requests.
  useEffect(() => {
    if (step !== 'confirm') return
    if (!isValidPhone(form.clientPhone)) { setLookup(null); return }
    const controller = new AbortController()
    const t = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/clients/lookup?phone=${encodeURIComponent(form.clientPhone)}`, { signal: controller.signal })
        const json = await res.json()
        if (json.success && json.data.found && json.data.name) {
          setLookup({ name: json.data.name })
          setLookupDismissed(false)
        } else {
          setLookup(null)
        }
      } catch { /* aborted or offline — silently ignore */ }
    }, 500)
    return () => { clearTimeout(t); controller.abort() }
  }, [step, form.clientPhone])

  // The professional step only appears when the admin enabled it AND there is at
  // least one active professional to choose from.
  const effectiveShowProfessionalStep = showProfessionalStep && professionals.length > 0

  // Steps adjust automatically when the admin toggles professional selection.
  const STEPS: FormStep[] = effectiveShowProfessionalStep
    ? ['service', 'professional', 'datetime', 'confirm']
    : ['service', 'datetime', 'confirm']

  // Defensive: if the step becomes unavailable while the client is on it
  // (e.g. settings loaded a beat late), bump them forward instead of stranding them.
  useEffect(() => {
    if (!effectiveShowProfessionalStep && step === 'professional') setStep('datetime')
  }, [effectiveShowProfessionalStep, step])

  const selectedService = services.find((s) => s.id === form.serviceId)
  const isVipCategory = form.category === VIP_PSEUDO_CATEGORY
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? ''
  // Categories that actually have at least one (active) service to offer.
  const categoriesWithServices = categories
    .map((cat) => ({ cat, count: services.filter((s) => s.categoryId === cat.id).length }))
    .filter((g) => g.count > 0)
  const isMulti = isVipCategory && form.serviceIds.length > 1

  // Selected services (any category) and computed totals
  const selectedServices = services.filter((s) => form.serviceIds.includes(s.id))
  const totalDuration = selectedServices.reduce((sum, s) => sum + s.durationMinutes, 0)
  const subtotal = selectedServices.reduce((sum, s) => sum + s.price, 0)

  // VIP discount: only inside the VIP pseudo-category, 2+ services unlock a tiered discount (parametrized in admin)
  const discountPercent = isVipCategory ? resolveDiscountPercent(form.serviceIds.length, vipSettings) : 0
  const discountAmount = Math.round(subtotal * discountPercent / 100)

  // Use totalDuration for availability when multiple services are selected
  const availabilityDuration = isMulti ? totalDuration : undefined
  const availabilityServiceId = isMulti ? undefined : form.serviceId

  function updateForm(field: keyof FormData, value: string | string[]) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (typeof value === 'string' && field in fieldErrors) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    }
    setStepError(null)
  }

  // Consent-based: only runs when the visitor taps "Autocompletar". Fills the
  // name from the server; the email stays device-private (localStorage) and is
  // never fetched, so we don't disclose it to whoever holds the phone.
  function applyAutofill() {
    if (!lookup) return
    setForm((prev) => ({
      ...prev,
      clientName:  lookup.name,
      clientEmail: prev.clientEmail || savedClientData.clientEmail,
    }))
    setFieldErrors({})
    setLookupDismissed(true)
  }

  function toggleService(id: string) {
    setForm((prev) => {
      const ids = prev.serviceIds.includes(id)
        ? prev.serviceIds.filter((i) => i !== id)
        : [...prev.serviceIds, id]
      return { ...prev, serviceIds: ids, serviceId: ids[0] ?? '' }
    })
    setStepError(null)
    setTimeout(() => continueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80)
  }

  function selectService(id: string) {
    updateForm('serviceId', id)
    updateForm('serviceIds', [id])
    setStepError(null)
    setTimeout(() => continueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80)
  }

  // Selects a category card (or the VIP combo card). Clicking the
  // already-active one toggles it off, returning to the category grid.
  function selectCategory(cat: string) {
    setForm((prev) => ({
      ...prev,
      category:   prev.category === cat ? '' : cat,
      serviceId:  '',
      serviceIds: [],
    }))
    setStepError(null)
  }

  function validate(): boolean {
    setAttempted(true)
    if (step === 'service') {
      if (!form.category) { setStepError('Por favor selecciona una categoría para continuar.'); return false }
      if (isVipCategory) {
        // VIP needs at least 2 services for the bundle discount to apply.
        if (form.serviceIds.length < 2) { setStepError('Selecciona al menos 2 servicios para el Paquete VIP.'); return false }
        return true
      }
      if (form.serviceIds.length === 0) { setStepError('Por favor selecciona al menos un servicio para continuar.'); return false }
      return true
    }
    if (step === 'datetime') {
      if (!form.startTime) { setStepError('Por favor selecciona una hora disponible.'); return false }
      return true
    }
    if (step === 'confirm') {
      const errors: FieldErrors = {}
      if (form.clientName.trim().length < 2)
        errors.clientName = 'Ingresa tu nombre completo (mínimo 2 caracteres).'
      // Email is optional — only validate the format if something was typed.
      if (form.clientEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.clientEmail.trim()))
        errors.clientEmail = 'Ingresa un email válido (ej: correo@dominio.com).'
      if (!isValidPhone(form.clientPhone))
        errors.clientPhone = 'Ingresa un número de teléfono válido (mínimo 10 dígitos).'
      if (Object.keys(errors).length > 0) { setFieldErrors(errors); return false }
      return true
    }
    return true
  }

  function handleNext() {
    if (!validate()) {
      // The validation message renders near the top of the step; on a long list
      // (e.g. VIP) the user is at the bottom, so bring it into view.
      formTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    const idx = STEPS.indexOf(step)
    if (idx < STEPS.length - 1) setStep(STEPS[idx + 1])
  }

  function handlePrev() {
    if (step === 'service' && form.category) {
      selectCategory(form.category) // toggle off -> back to the category grid
      return
    }
    const idx = STEPS.indexOf(step)
    if (idx > 0) setStep(STEPS[idx - 1])
    else router.push('/')   // from the first step, leave the booking back to home
  }

  async function handleSubmit() {
    if (!validate()) return
    setSubmitting(true)
    setSubmitError(null)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000) // 12s max

    try {
      const body: Record<string, unknown> = {
        date:        form.date,
        startTime:   form.startTime,
        clientName:  form.clientName.trim(),
        clientEmail: form.clientEmail.toLowerCase().trim(),
        clientPhone: form.clientPhone.trim(),
        notes:       form.notes.trim() || undefined,
      }

      if (form.professionalId) body.professionalId = form.professionalId

      if (isMulti) {
        body.serviceId = form.serviceIds[0]
        body.serviceIds = form.serviceIds
        body.totalDurationMinutes = totalDuration
      } else {
        body.serviceId = form.serviceId
      }

      const res = await fetch('/api/appointments', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        signal:  controller.signal,
        body: JSON.stringify(body),
      })

      clearTimeout(timeout)
      const json = await res.json()

      if (!json.success) {
        if (res.status === 409) {
          setForm((prev) => ({ ...prev, startTime: '' }))
          setStep('datetime')
          setSubmitError(json.error ?? 'Este horario acaba de ser reservado. Por favor elige otro.')
          return
        }
        if (res.status === 503) {
          setSubmitError('El sistema está en mantenimiento. Por favor intenta en unos minutos.')
          return
        }
        setSubmitError(json.error ?? 'Ocurrió un error. Intenta de nuevo.')
        return
      }
      // GA4: booking confirmed — report the final price as the conversion value.
      trackBookingConfirmed(summaryTotal)
      // Pass the cancel token in the URL (only for the person who just booked)
      // so the confirmation screen can show the cancel link without exposing the
      // token via a public GET — essential for clients who left no email.
      router.push(`/confirmacion?id=${json.data.id}${json.data.cancelToken ? `&token=${json.data.cancelToken}` : ''}`)
    } catch (err) {
      clearTimeout(timeout)
      if (err instanceof DOMException && err.name === 'AbortError') {
        setSubmitError('La solicitud tardó demasiado. Verifica tu conexión e intenta de nuevo.')
      } else {
        setSubmitError('Error de conexión. Por favor intenta de nuevo.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  function inputClass(error?: string) {
    return `input-field ${error ? 'border-red-400 focus:border-red-400 bg-red-50/30' : ''}`
  }

  // Summary data for confirm step
  const summaryServices = isMulti ? selectedServices : selectedService ? [selectedService] : []
  const summaryDuration = isMulti ? totalDuration : selectedService?.durationMinutes ?? 0
  const summaryTotal = subtotal - discountAmount
  const selectedProfessional = professionals.find((p) => p.id === form.professionalId)

  return (
    <div ref={formTopRef} className="max-w-2xl mx-auto">

      {/* Step indicator */}
      <div className="flex items-center mb-6">
        {STEPS.map((s, i) => {
          const current  = STEPS.indexOf(step)
          const isDone   = i < current
          const isActive = s === step
          return (
            <div key={s} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all
                  ${isDone ? 'bg-gold border-gold text-white'
                    : isActive ? 'bg-ink border-ink text-gold-light shadow-[0_0_0_5px_rgba(184,147,42,0.18)]'
                    : 'bg-white border-beige-dark text-ink-muted'}`}>
                  {isDone ? '✓' : i + 1}
                </div>
                <span className={`text-[11px] mt-1.5 font-semibold hidden sm:block ${isActive ? 'text-ink' : 'text-ink-muted'}`}>
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

      {/* Urgency badge — only on step 1, count comes from real today's availability */}
      {step === 'service' && cupos !== null && (
        <div className="inline-flex items-center gap-2 bg-gold-pale text-gold-dark text-xs font-semibold px-3.5 py-1.5 rounded-full mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          Quedan {cupos} cupo{cupos === 1 ? '' : 's'} para hoy
        </div>
      )}

      {submitError && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 text-red-600 text-sm px-4 py-3 mb-6">
          <span className="mt-0.5">⚠</span> {submitError}
        </div>
      )}

      {/* STEP 1a — Category cards. Picking one (or the VIP combo) reveals the service list below. */}
      {step === 'service' && !form.category && (
        <div className="animate-fade-in">
          <div className="mb-6">
            <h2 className="font-serif text-2xl text-ink">¿Cómo te quieres consentir?</h2>
            <p className="text-sm text-ink-muted mt-1">Elige la categoría que mejor describe tu servicio. <span className="text-red-500">*</span></p>
          </div>
          {stepError && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-200 px-4 py-3 mb-4">
              <span>⚠</span> {stepError}
            </div>
          )}
          {loadingSvc ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1,2,3,4].map((n) => <div key={n} className="h-28 bg-beige-dark animate-pulse rounded-2xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {categoriesWithServices.map(({ cat, count }) => (
                  <button key={cat.id} type="button" onClick={() => selectCategory(cat.id)}
                    className="text-left p-6 rounded-2xl border border-beige-dark bg-white hover:border-gold/50
                               transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
                    <span className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4 bg-gold-pale text-gold-dark">
                      <Icon name={cat.icon} className="w-7 h-7" />
                    </span>
                    <p className="font-serif text-xl text-ink">{cat.name}</p>
                    <p className="text-sm text-ink-muted leading-snug mt-1.5">
                      {cat.description ?? ''}
                    </p>
                    <p className="text-[11px] tracking-widest uppercase text-gold-dark font-semibold mt-3">
                      {count} servicio{count === 1 ? '' : 's'}
                    </p>
                  </button>
                ))}

              {/* VIP pseudo-category: the only path that unlocks multi-service selection + tiered discount */}
              {services.length >= 2 && (
                <button type="button" onClick={() => selectCategory(VIP_PSEUDO_CATEGORY)}
                  className="text-left p-6 rounded-2xl border border-ink bg-ink hover:border-gold/60
                             transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5">
                  <span className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4 bg-[rgba(212,173,90,.15)] text-[var(--gold-light)]">
                    <Icon name="promo" className="w-7 h-7" />
                  </span>
                  <p className="font-serif text-xl text-white">Paquete VIP</p>
                  <p className="text-sm text-[#b7ae9c] leading-snug mt-1.5">
                    {VIP_BLURB}
                  </p>
                  <p className="text-[11px] tracking-widest uppercase text-[var(--gold-light)] font-semibold mt-3">
                    Reserva doble
                  </p>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 1b — Service. VIP: every active service, multi-select. Other categories: single-select. */}
      {step === 'service' && form.category && (
        <div className="space-y-3 animate-fade-in">
          <div className="mb-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-serif text-2xl text-ink">
                {isVipCategory ? (
                  'Elige tus servicios'
                ) : (
                  <>Servicios de <em className="text-gold italic">{categoryName(form.category).toLowerCase()}</em></>
                )}
              </h2>
              {/* VIP shows all categories at once → "change category" doesn't apply. */}
              {!isVipCategory && (
                <button type="button" onClick={() => selectCategory(form.category)}
                  className="text-xs tracking-widest uppercase font-semibold text-gold-dark hover:text-gold
                             border border-gold/40 rounded-full px-3 py-1.5 transition-colors">
                  ← Cambiar categoría
                </button>
              )}
            </div>
            <p className="text-sm text-ink-muted mt-1">
              {isVipCategory
                ? 'Selecciona 2 o más servicios (de cualquier categoría) para activar el descuento VIP.'
                : 'Selecciona uno de los servicios disponibles. '}
              <span className="text-red-500">*</span>
            </p>
          </div>
          {stepError && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-200 px-4 py-3">
              <span>⚠</span> {stepError}
            </div>
          )}
          {loadingSvc ? (
            <div className="space-y-3">{[1,2,3].map((n) => <div key={n} className="h-20 bg-beige-dark animate-pulse" />)}</div>
          ) : isVipCategory ? (
            categoriesWithServices
              .map(({ cat }) => (
                <div key={cat.id}>
                  <p className="text-[11px] tracking-widest uppercase text-ink-muted font-semibold mb-2 mt-4">
                    {cat.name}
                  </p>
                  {services.filter((svc) => svc.categoryId === cat.id).map((svc) => {
                    const isSelected = form.serviceIds.includes(svc.id)
                    return (
                      <button key={svc.id} type="button"
                        role="checkbox" aria-checked={isSelected}
                        onClick={() => toggleService(svc.id)}
                        className={`w-full text-left p-5 rounded-2xl border transition-all duration-150 hover:shadow-sm mb-2
                          ${isSelected ? 'border-gold bg-gold-pale ring-1 ring-gold'
                          : attempted && form.serviceIds.length === 0 ? 'border-red-300 bg-white hover:border-gold/50'
                          : 'border-beige-dark bg-white hover:border-gold/50'}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors
                              ${isSelected ? 'border-gold bg-gold' : 'border-beige-deeper'}`}>
                              {isSelected && <span className="text-white text-xs">✓</span>}
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
                  })}
                </div>
              ))
          ) : (
            services
              .filter((svc) => svc.categoryId === form.category)
              .map((svc) => {
                const isSelected = form.serviceId === svc.id
                return (
                  <button key={svc.id} type="button"
                    role="radio" aria-checked={isSelected}
                    onClick={() => selectService(svc.id)}
                    className={`w-full text-left p-5 rounded-2xl border transition-all duration-150 hover:shadow-sm
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

          {/* VIP multi-service cart with live discount preview */}
          {isVipCategory && form.serviceIds.length > 0 && (
            <div className="bg-gold-pale/60 border border-gold/20 rounded-xl px-4 py-3 mt-4 space-y-2">
              {selectedServices.map((s) => (
                <div key={s.id} className="flex justify-between items-center text-sm">
                  <span className="text-ink">{s.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-gold-dark font-medium">{formatPrice(s.price)}</span>
                    <button type="button" onClick={() => toggleService(s.id)}
                      className="text-ink-muted hover:text-red-500 transition-colors text-xs">
                      Quitar
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex justify-between items-center text-sm border-t border-gold/20 pt-2 mt-1">
                <span className="text-ink-muted">
                  {form.serviceIds.length} servicio{form.serviceIds.length === 1 ? '' : 's'} · {totalDuration} min
                  {discountPercent > 0 && (
                    <span className="text-gold-dark font-semibold"> · {discountPercent}% descuento VIP</span>
                  )}
                </span>
                <span className="font-serif text-gold-dark font-medium">
                  {formatPrice(subtotal - discountAmount)}
                </span>
              </div>
              {form.serviceIds.length < 2 && (
                <p className="flex items-center gap-1.5 text-amber-600 text-xs pt-1">
                  <span>⚠</span> Selecciona al menos 2 servicios para activar el descuento VIP.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* STEP 2 — Professional, or "Primera disponible" */}
      {step === 'professional' && (
        <div className="animate-fade-in">
          <div className="mb-6">
            <h2 className="font-serif text-2xl text-ink">Elige tu profesional</h2>
            <p className="text-sm text-ink-muted mt-1">O deja que asignemos la primera disponible.</p>
          </div>
          {loadingPro ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[1,2,3,4].map((n) => <div key={n} className="h-28 bg-beige-dark animate-pulse rounded-2xl" />)}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {professionals.map((pro) => {
                const isSelected = form.professionalId === pro.id
                return (
                  <button key={pro.id} type="button"
                    role="radio" aria-checked={isSelected}
                    onClick={() => updateForm('professionalId', pro.id)}
                    className={`text-left p-5 rounded-2xl border transition-all duration-200 hover:shadow-sm
                      ${isSelected ? 'border-gold bg-gold-pale ring-1 ring-gold' : 'border-beige-dark bg-white hover:border-gold/50'}`}>
                    <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-gold-pale text-gold-dark font-serif text-lg mb-3">
                      {pro.name.charAt(0)}
                    </span>
                    <p className="font-medium text-ink">{pro.name}</p>
                    {pro.specialty && <p className="text-sm text-ink-muted mt-0.5">{pro.specialty}</p>}
                    <p className="text-xs text-gold-dark mt-2">★ {pro.rating.toFixed(1)} · {pro.reviewCount} citas</p>
                  </button>
                )
              })}
              <button type="button"
                role="radio" aria-checked={form.professionalId === ''}
                onClick={() => updateForm('professionalId', '')}
                className={`text-left p-5 rounded-2xl border transition-all duration-200 hover:shadow-sm
                  ${form.professionalId === '' ? 'border-gold bg-gold-pale ring-1 ring-gold' : 'border-beige-dark bg-white hover:border-gold/50'}`}>
                <span className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-gold-pale text-gold-dark text-lg mb-3">
                  ✦
                </span>
                <p className="font-medium text-ink">Primera disponible</p>
                <p className="text-sm text-ink-muted mt-0.5">La hora más rápida</p>
                <p className="text-[11px] tracking-widest uppercase text-gold-dark font-semibold mt-2">Recomendado</p>
              </button>
            </div>
          )}
        </div>
      )}

      {/* STEP 3 — Date and time */}
      {step === 'datetime' && (
        <div className="animate-fade-in max-w-[480px] mx-auto">
          <div className="mb-6">
            <h2 className="font-serif text-2xl text-ink">Elige fecha y hora</h2>
            <p className="text-sm text-ink-muted mt-1">Selecciona el día y un horario disponible. <span className="text-red-500">*</span></p>
          </div>

          {/* Service summary */}
          {isMulti ? (
            <div className="flex items-center justify-between bg-gold-pale/60 border border-gold/20 rounded-xl px-4 py-3 mb-6">
              <div className="min-w-0">
                <p className="text-[10px] tracking-widest uppercase text-gold-dark mb-0.5">
                  Servicios elegidos
                </p>
                <p className="text-sm text-ink font-medium truncate">
                  {selectedServices.map((s) => s.name).join(' + ')}
                  <span className="text-ink-muted font-normal"> · {totalDuration} min</span>
                </p>
              </div>
              <button type="button" onClick={() => setStep('service')}
                className="shrink-0 text-xs tracking-widest uppercase text-ink-muted hover:text-gold transition-colors">
                Cambiar
              </button>
            </div>
          ) : selectedService && (
            <div className="flex items-center justify-between bg-gold-pale/60 border border-gold/20 rounded-xl px-4 py-3 mb-6">
              <div className="min-w-0">
                <p className="text-[10px] tracking-widest uppercase text-gold-dark mb-0.5">
                  Servicio elegido
                </p>
                <p className="text-sm text-ink font-medium truncate">
                  {selectedService.name}
                  <span className="text-ink-muted font-normal"> · {selectedService.durationMinutes} min</span>
                </p>
              </div>
              <button type="button" onClick={() => setStep('service')}
                className="shrink-0 text-xs tracking-widest uppercase text-ink-muted hover:text-gold transition-colors">
                Cambiar
              </button>
            </div>
          )}

          {stepError && (
            <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-200 px-4 py-3 mb-4">
              <span>⚠</span> {stepError}
            </div>
          )}
          <DateTimePicker
            serviceId={availabilityServiceId}
            durationMinutes={availabilityDuration}
            professionalId={form.professionalId || undefined}
            maxAdvanceDays={maxAdvanceDays}
            selectedDate={form.date}
            selectedTime={form.startTime}
            onDateChange={(d) => updateForm('date', d)}
            onTimeChange={(t) => {
              updateForm('startTime', t)
              setStepError(null)
              setSubmitError(null)
              setTimeout(() => continueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80)
            }}
          />
        </div>
      )}

      {/* STEP 4 — Confirm: summary + contact data + submit, in one screen */}
      {step === 'confirm' && (
        <div className="animate-fade-in space-y-6">
          <div className="mb-2">
            <h2 className="font-serif text-2xl text-ink">Confirma tu cita</h2>
            <p className="text-sm text-ink-muted mt-1">Revisa los datos antes de confirmar.</p>
          </div>

          <div className="bg-white border border-beige-dark rounded-2xl p-6 shadow-sm">
            {summaryServices.length > 1 ? (
              <div className="flex justify-between text-[15px] border-b border-dashed border-beige-deeper py-3">
                <span className="text-ink-muted">Servicios</span>
                <span className="font-serif text-ink font-semibold text-right max-w-[60%]">
                  {summaryServices.map((s) => s.name).join(' + ')}
                </span>
              </div>
            ) : (
              <div className="flex justify-between text-[15px] border-b border-dashed border-beige-deeper py-3">
                <span className="text-ink-muted">Servicio</span>
                <span className="font-serif text-ink font-semibold text-right max-w-[60%]">{summaryServices[0]?.name ?? ''}</span>
              </div>
            )}
            {effectiveShowProfessionalStep && (
              <div className="flex justify-between text-[15px] border-b border-dashed border-beige-deeper py-3">
                <span className="text-ink-muted">Profesional</span>
                <span className="text-ink font-medium text-right max-w-[60%]">{selectedProfessional?.name ?? 'Primera disponible'}</span>
              </div>
            )}
            {[
              { label: 'Fecha',     value: format(new Date(`${form.date}T12:00:00`), "EEEE d 'de' MMMM", { locale: es }) },
              { label: 'Hora',      value: form.startTime },
              { label: 'Duración',  value: `${summaryDuration} minutos` },
            ].map(({ label, value }) => (
              <div key={label} className="flex justify-between text-[15px] border-b border-dashed border-beige-deeper py-3">
                <span className="text-ink-muted">{label}</span>
                <span className="text-ink font-medium text-right max-w-[60%] first-letter:uppercase">{value}</span>
              </div>
            ))}
            <div className="flex justify-between text-[15px] border-b border-dashed border-beige-deeper py-3">
              <span className="text-ink-muted">Subtotal</span>
              <span className="text-ink font-medium">{formatPrice(subtotal)}</span>
            </div>
            {discountPercent > 0 && (
              <div className="flex justify-between text-[15px] border-b border-dashed border-beige-deeper py-3">
                <span className="text-gold-dark font-medium">Descuento VIP ({discountPercent}%)</span>
                <span className="text-gold-dark font-medium">-{formatPrice(discountAmount)}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-4 mt-1 border-t-2 border-ink">
              <span className="text-ink-muted text-sm">Total</span>
              <span className="font-serif text-2xl text-gold-dark font-semibold">{formatPrice(summaryTotal)}</span>
            </div>
          </div>

          {/* datalists: feed dropdown suggestions for each field.
              The field starts empty — the user chooses whether to use the saved value. */}
          {mounted && (
            <>
              <datalist id="dl-name">
                {savedClientData.clientName  && <option value={savedClientData.clientName} />}
              </datalist>
              <datalist id="dl-email">
                {savedClientData.clientEmail && <option value={savedClientData.clientEmail} />}
              </datalist>
              <datalist id="dl-phone">
                {savedClientData.clientPhone && <option value={savedClientData.clientPhone} />}
              </datalist>
            </>
          )}

          <div className="space-y-5">
            {/* Phone first: the phone IS the client's identity, so we ask it up
                front and offer to recognize returning clients (with consent). */}
            <div>
              <label className="form-label">Teléfono / WhatsApp <span className="text-red-500">*</span></label>
              <input
                type="tel"
                list="dl-phone"
                className={inputClass(fieldErrors.clientPhone)}
                placeholder="300 000 0000"
                value={form.clientPhone}
                onChange={(e) => updateForm('clientPhone', e.target.value)}
                autoComplete="tel"
              />
              {fieldErrors.clientPhone && (
                <p className="flex items-center gap-1.5 text-red-500 text-xs mt-1.5"><span>⚠</span> {fieldErrors.clientPhone}</p>
              )}

              {/* Returning-client recognition — consent-based, never auto-applied */}
              {lookup && !lookupDismissed && form.clientName.trim() !== lookup.name && (
                <div className="flex items-center justify-between gap-3 bg-gold-pale border border-gold/30 rounded-xl px-4 py-2.5 mt-2 animate-fade-in">
                  <p className="text-sm text-ink">
                    ¿Eres <strong className="text-gold-dark">{lookup.name}</strong>? Ya tienes datos con nosotros.
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    <button type="button" onClick={applyAutofill}
                      className="text-xs font-semibold text-gold-dark border border-gold/40 rounded-full px-3 py-1.5 hover:bg-gold/10 transition-colors">
                      Autocompletar
                    </button>
                    <button type="button" onClick={() => setLookupDismissed(true)}
                      className="text-xs text-ink-muted hover:text-ink transition-colors" aria-label="Descartar sugerencia">
                      No
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Nombre completo <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  list="dl-name"
                  className={inputClass(fieldErrors.clientName)}
                  placeholder="Tu nombre y apellido"
                  value={form.clientName}
                  onChange={(e) => updateForm('clientName', e.target.value)}
                  autoComplete="name"
                />
                {fieldErrors.clientName && (
                  <p className="flex items-center gap-1.5 text-red-500 text-xs mt-1.5"><span>⚠</span> {fieldErrors.clientName}</p>
                )}
              </div>
              <div>
                <label className="form-label">
                  Email <span className="text-ink-muted/60 normal-case font-normal tracking-normal">(opcional)</span>
                </label>
                <input
                  type="email"
                  list="dl-email"
                  className={inputClass(fieldErrors.clientEmail)}
                  placeholder="tu@email.com"
                  value={form.clientEmail}
                  onChange={(e) => updateForm('clientEmail', e.target.value)}
                  autoComplete="email"
                />
                {fieldErrors.clientEmail ? (
                  <p className="flex items-center gap-1.5 text-red-500 text-xs mt-1.5"><span>⚠</span> {fieldErrors.clientEmail}</p>
                ) : (
                  <p className="text-xs text-ink-muted/60 mt-1.5">
                    Si lo proporcionas, recibirás confirmación y recordatorios automáticos de tu cita.
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="form-label">
                Notas adicionales{' '}
                <span className="text-ink-muted/60 normal-case font-normal tracking-normal">(opcional)</span>
              </label>
              <textarea
                className="input-field resize-none"
                rows={3}
                placeholder="Ej: prefiero esmalte nude, tengo uñas acrílicas previas..."
                value={form.notes}
                onChange={(e) => updateForm('notes', e.target.value)}
                maxLength={500}
              />
              <p className="text-xs text-ink-muted/50 mt-1 text-right">{form.notes.length}/500</p>
            </div>
          </div>

          <p className="text-xs text-ink-muted leading-relaxed">
            {form.clientEmail.trim() ? (
              <>Recibirás un <strong className="text-ink">email de confirmación</strong> de inmediato. </>
            ) : (
              <>Sin email no recibirás notificaciones — en la siguiente pantalla podrás <strong className="text-ink">guardar el enlace de tu cita</strong>. </>
            )}
            Si necesitas cancelar, hazlo con al menos 24 horas de anticipación.
          </p>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-10 pt-6 border-t border-beige-dark">
        <button type="button" onClick={handlePrev} className="btn-secondary" disabled={submitting}>
          {step === 'service' && !form.category ? '← Volver al inicio' : '← Atrás'}
        </button>
        {step !== 'confirm' ? (
          <button ref={continueRef} type="button" onClick={handleNext} className="btn-cta">Continuar →</button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={submitting} className="btn-cta disabled:opacity-70">
            {submitting ? 'Confirmando...' : 'Confirmar cita'}
          </button>
        )}
      </div>

    </div>
  )
}
