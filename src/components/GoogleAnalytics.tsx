'use client'
// src/components/GoogleAnalytics.tsx
// Google Analytics 4 loader. Rendered once from the root layout but:
//   • disabled when NEXT_PUBLIC_GA_MEASUREMENT_ID is missing (dev/local),
//   • never active on /admin — internal admin actions must not be tracked.
// Uses next/script (afterInteractive) so it never blocks render, and re-sends a
// page_view on client-side navigation (App Router doesn't do it automatically).
// We read only usePathname (not useSearchParams) to avoid opting the whole tree
// out of static rendering / ISR.

import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

const GA_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

export function GoogleAnalytics() {
  const pathname = usePathname()
  const firstLoad = useRef(true)

  // Active only on public pages, and only when an ID is configured.
  const enabled = !!GA_ID && !pathname.startsWith('/admin')

  useEffect(() => {
    if (!enabled) return
    // The inline config below already sends the first page_view; only emit one
    // for subsequent in-app navigations.
    if (firstLoad.current) { firstLoad.current = false; return }
    window.gtag?.('event', 'page_view', { page_path: pathname })
  }, [pathname, enabled])

  if (!enabled) return null

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}', { page_path: window.location.pathname });
        `}
      </Script>
    </>
  )
}
