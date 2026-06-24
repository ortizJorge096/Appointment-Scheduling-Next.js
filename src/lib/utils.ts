// src/lib/utils.ts
// General-purpose helpers — valentinajimenez

type ClassValue = string | undefined | null | false

/** Safely combines Tailwind classes (similar to shadcn's cn) */
export function cn(...inputs: ClassValue[]) {
  return inputs.filter(Boolean).join(' ')
}

/** Formats a price in COP */
export function formatPrice(price: number): string {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
  }).format(price)
}

/** Formats a date in Colombian Spanish */
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

/** Builds a short booking code from the ID */
export function shortCode(id: string): string {
  return id.slice(0, 8).toUpperCase()
}

/** Truncates a long string with an ellipsis */
export function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max) + '...' : str
}

/** Checks whether a date is in the past */
export function isPast(date: Date | string): boolean {
  return new Date(date) < new Date()
}

/** Async pause (for retry logic) */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
