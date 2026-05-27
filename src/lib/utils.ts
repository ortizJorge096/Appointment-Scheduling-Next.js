// src/lib/utils.ts
// Helpers generales — valentinajimenez

import { type ClassValue, clsx } from 'clsx'

/** Combina clases de Tailwind de forma segura (similar a cn de shadcn) */
export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(' ')
}

/** Formatea precio en COP */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(price)
}

/** Formatea fecha en español colombiano */
export function formatDate(date: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('es-CO', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'America/Bogota',
    ...options,
  })
}

/** Genera código corto de reserva a partir del ID */
export function shortCode(id: string): string {
  return id.slice(0, 8).toUpperCase()
}

/** Trunca un string largo con ellipsis */
export function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '...' : str
}

/** Verifica si una fecha es pasada */
export function isPast(date: Date | string): boolean {
  return new Date(date) < new Date()
}

/** Pausa asíncrona (para retry logic) */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
