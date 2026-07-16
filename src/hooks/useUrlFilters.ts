// src/hooks/useUrlFilters.ts
// URL search params as the single source of truth for list filters (survives
// refresh, back/forward and shared links). Extracts the identical `setParams`
// merger duplicated in ClientesPageClient and AuditoriaPageClient.

import { useCallback } from 'react'
import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export function useUrlFilters() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  /** Merge updates into the query string; empty/null values are removed.
   *  Uses `replace` (not `push`) so filtering doesn't spam the history. */
  const setParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    const qs = params.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }, [router, pathname, searchParams])

  /** Clears every query param (e.g. a "reset filters" button). */
  const reset = useCallback(() => {
    router.replace(pathname, { scroll: false })
  }, [router, pathname])

  return { searchParams, setParams, reset }
}
