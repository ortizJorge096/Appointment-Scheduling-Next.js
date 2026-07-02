// src/lib/analytics.ts
// Thin, typed wrapper over Google Analytics 4 (gtag). Every helper is a safe
// no-op when gtag isn't loaded — i.e. in dev without an ID, on /admin (GA is
// never injected there), or before the script finishes loading. So call sites
// don't need to guard.

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

type GaParams = Record<string, unknown>

export function gaEvent(name: string, params: GaParams = {}): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('event', name, params)
}

// ── Business events ──────────────────────────────────────────
// Fired when a visitor starts the booking flow (lands on /agendar).
export function trackBeginBooking(): void {
  gaEvent('begin_checkout', { event_category: 'booking', event_label: 'start_booking' })
}

// Fired when a booking is successfully confirmed. `value` is the final price (COP).
export function trackBookingConfirmed(value: number): void {
  gaEvent('purchase', {
    event_category: 'booking',
    event_label: 'booking_confirmed',
    currency: 'COP',
    value,
  })
}

// Fired when a visitor clicks a WhatsApp CTA.
export function trackWhatsAppClick(): void {
  gaEvent('contact', { event_category: 'engagement', event_label: 'whatsapp_click' })
}
