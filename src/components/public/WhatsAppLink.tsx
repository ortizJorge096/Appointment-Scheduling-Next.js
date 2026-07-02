'use client'
// src/components/public/WhatsAppLink.tsx
// A WhatsApp anchor that reports a GA4 `contact` event on click. Use it for any
// public WhatsApp CTA so click tracking stays consistent (the floating FAB has
// its own bespoke markup and tracks the same event directly).

import { WHATSAPP_URL } from '@/lib/config'
import { trackWhatsAppClick } from '@/lib/analytics'

export default function WhatsAppLink({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noreferrer"
      onClick={() => trackWhatsAppClick()}
      className={className}
    >
      {children}
    </a>
  )
}
