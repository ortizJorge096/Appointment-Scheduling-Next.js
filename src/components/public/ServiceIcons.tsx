// src/components/public/ServiceIcons.tsx
// Line (stroke) icons for the studio services.
// They use `currentColor`, so they inherit the container color (e.g. text-gold).
// Style consistent with the brand mark: thin, gold, minimal strokes.
import type { ReactElement, SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>
type IconComponent = (props: IconProps) => ReactElement

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** Manicura / nails — hand with polished nail */
export function ManicuraIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 13V5.5a1.5 1.5 0 0 1 3 0V11" />
      <path d="M12 11V4.2a1.5 1.5 0 0 1 3 0V11" />
      <path d="M15 11V5.5a1.5 1.5 0 0 1 3 0V13c0 3.6-2.4 6.5-6 6.5s-6-2.2-6-5.2c0-1 .5-1.8 1.4-2.1l1.6-.6" />
      <path d="M10 4.6c.4-.5 1-.8 1.5-.8" opacity="0.5" />
    </svg>
  )
}

/** Pedicura — foot with sparkles */
export function PedicuraIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M8 4c-1 2-1.3 4.5-1.3 7 0 2.2.4 4 .4 5.4 0 1.4-.8 2.3-2 2.3" />
      <path d="M7 18.7h7.5c1.4 0 2.5-.9 2.8-2.2l.6-2.8c.2-1-.5-1.9-1.5-1.9-.8 0-1.5.6-1.6 1.4" />
      <path d="M9.5 5.2c2-1 4-.6 5 .9" />
      <circle cx="11" cy="4.4" r="0.5" fill="currentColor" stroke="none" />
      <circle cx="13.5" cy="6" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

/** Pestañas — eye with defined lashes */
export function PestanasIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 13c3-4 6-6 9.5-6s6.5 2 9.5 6" />
      <path d="M12 17.2a3.4 3.4 0 0 1-3.4-3.4" />
      <circle cx="12" cy="13.2" r="2.4" />
      <path d="M4.6 14.6 3 16.4M8 16.6 7.2 18.8M12 17.4V19.8M16 16.6l.8 2.2M19.4 14.6 21 16.4" />
    </svg>
  )
}

/** Brows and lashes — designed brow over eye */
export function CejasIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M3.5 7.5c2.2-1.8 5-2.6 8-2.6s5.5.8 8 2.6" />
      <path d="M3.5 7.5c2.5-.3 4.8 0 7 .9" opacity="0.55" />
      <path d="M4 13.5c2.4-3 5-4.4 8-4.4s5.6 1.4 8 4.4" />
      <path d="M12 17a3.3 3.3 0 0 1-3.3-3.3" />
      <circle cx="12" cy="13.4" r="2.3" />
    </svg>
  )
}

/** Waxing — precision tweezers with spark */
export function DepilacionIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M9 3.5 7 12.5c-.4 1.7-.4 3.3.5 4.8" />
      <path d="M14.5 3.5 16.6 12.5c.4 1.7.4 3.3-.5 4.8" />
      <path d="M11.7 19.6c-.9-.6-1.5-1.6-1.5-2.8M12.3 19.6c.9-.6 1.5-1.6 1.5-2.8" />
      <path d="M9.3 4.6h5.2" />
      <path d="M5 6.5 3.4 5M5.5 9.2 3.6 8.6" opacity="0.6" />
    </svg>
  )
}

/** Haircut — scissors */
export function CorteIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="6" cy="6.5" r="2.5" />
      <circle cx="6" cy="17.5" r="2.5" />
      <path d="M8.2 8 20 18.5M8.2 16 20 5.5" />
      <path d="M11 12l3.2 2.7" opacity="0.5" />
    </svg>
  )
}

/** Promos / combos — sparkle */
export function PromoIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z" />
      <path d="M18 16.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" opacity="0.7" />
    </svg>
  )
}

/** Location pin — for address */
export function PinIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M12 21s7-7.6 7-12.6A7 7 0 0 0 5 8.4C5 13.4 12 21 12 21z" />
      <circle cx="12" cy="8.4" r="2.3" />
    </svg>
  )
}

/** Clock — for opening hours */
export function ClockIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.2 2" />
    </svg>
  )
}

/** Phone / WhatsApp handset */
export function PhoneIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <path d="M5 4h3.3l1.4 3.8-2 1.6a11.2 11.2 0 0 0 5.1 5.1l1.6-2 3.8 1.4V17c0 1-.8 1.7-1.7 1.6C9.6 17.8 5.2 13.4 4.4 7.7 4.3 6.8 4 4 5 4z" />
    </svg>
  )
}

/** Envelope — for email */
export function MailIcon(props: IconProps) {
  return (
    <svg {...base} {...props}>
      <rect x="3.5" y="6" width="17" height="12" rx="1.5" />
      <path d="M4.5 7.5 12 13l7.5-5.5" />
    </svg>
  )
}

// ── Predefined icon set — keys match ICON_KEYS in src/lib/config.ts ──
// Categories store one of these keys in their `icon` field. Keep both in sync.
export const ICON_REGISTRY: Record<string, IconComponent> = {
  manicura:   ManicuraIcon,
  pedicura:   PedicuraIcon,
  pestanas:   PestanasIcon,
  cejas:      CejasIcon,
  depilacion: DepilacionIcon,
  corte:      CorteIcon,
  promo:      PromoIcon,
}

/** Renders an icon by its registry key. Falls back to the promo icon. */
export function Icon({ name, ...props }: IconProps & { name: string | null | undefined }) {
  const Cmp = (name && ICON_REGISTRY[name]) || PromoIcon
  return <Cmp {...props} />
}

// ── List for marketing sections (the 5 services from the banner) ──
export const SERVICE_HIGHLIGHTS = [
  { label: 'Manicura',         Icon: ManicuraIcon  },
  { label: 'Pedicura',         Icon: PedicuraIcon  },
  { label: 'Cejas y Pestañas', Icon: CejasIcon     },
  { label: 'Depilación',       Icon: DepilacionIcon },
  { label: 'Corte de Cabello', Icon: CorteIcon     },
] as const
