'use client'
// src/hooks/useFieldValidation.ts
// Per-field form validation: tell the user as they leave each field, not once
// they hit Guardar. Extracted from ManualAppointmentModal, which is the
// reference implementation — ClientesPageClient had grown a second copy, and a
// third would have meant fixing the same bug in three places.
//
// Usage:
//   const FIELDS = ['name', 'phone'] as const          // module constant
//   const v = useFieldValidation(FIELDS, (k) => {
//     if (k === 'name'  && !form.name.trim())  return 'El nombre es requerido'
//     if (k === 'phone' && !isValidPhone(form.phone)) return 'Teléfono inválido'
//   })
//   <input onBlur={v.handleBlur('name')} className={v.errorOf('name') ? '…' : ''} />
//   {v.errorOf('name') && <p>{v.errorOf('name')}</p>}
//   // on submit:  if (Object.keys(v.validateAll()).length) return

import { useCallback, useRef, useState } from 'react'

type Errors<K extends string>  = Partial<Record<K, string>>
type Touched<K extends string> = Partial<Record<K, boolean>>

export function useFieldValidation<K extends string>(
  /** Must be a stable reference (module constant), not an inline array. */
  fields: readonly K[],
  validateField: (key: K) => string | undefined,
) {
  const [errors,  setErrors]  = useState<Errors<K>>({})
  const [touched, setTouched] = useState<Touched<K>>({})

  // The validator closes over form state, so it is a new function every render.
  // Behind a ref, the returned callbacks stay stable and never re-fire effects
  // in the components that consume them.
  const validate = useRef(validateField)
  validate.current = validateField
  const keys = useRef(fields)
  keys.current = fields

  /** onBlur handler: marks the field touched and validates just that field. */
  const handleBlur = useCallback((key: K) => () => {
    setTouched((t) => ({ ...t, [key]: true }))
    setErrors((e) => ({ ...e, [key]: validate.current(key) }))
  }, [])

  /** Clears a field's error as the user types — an error you are fixing should
   *  not keep shouting while you fix it. Re-checked on blur. */
  const clearError = useCallback((key: K) => {
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e))
  }, [])

  /** Submit: validates everything and reveals it all, since submit is the point
   *  where the user asked for a verdict on the whole form. */
  const validateAll = useCallback((): Errors<K> => {
    const errs: Errors<K> = {}
    for (const k of keys.current) {
      const err = validate.current(k)
      if (err) errs[k] = err
    }
    setErrors(errs)
    setTouched(Object.fromEntries(keys.current.map((k) => [k, true])) as Touched<K>)
    return errs
  }, [])

  const reset = useCallback(() => { setErrors({}); setTouched({}) }, [])

  /** The error to render: gated on touched, so an untouched form stays quiet. */
  const errorOf = (key: K): string | undefined => (touched[key] ? errors[key] : undefined)

  /** First field in declaration order with an error — for focusing it. */
  const firstErrorKey = (errs: Errors<K>): K | undefined => keys.current.find((k) => errs[k])

  return { errors, touched, handleBlur, clearError, validateAll, reset, errorOf, firstErrorKey }
}
