'use client'
// src/components/public/FooterServiceLinks.tsx
// Category links for the footer. Fetches active categories from the API so the
// footer reflects the live catalog (categories are now stored in the DB).

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Category {
  id: string
  name: string
  slug: string
}

export default function FooterServiceLinks() {
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((json) => { if (json.success) setCategories(json.data) })
      .catch(() => {})
  }, [])

  return (
    <ul className="space-y-2.5">
      {categories.map((cat) => (
        <li key={cat.id}>
          <Link href={`/agendar?categoria=${cat.slug}`}
            className="text-sm text-white/55 hover:text-gold transition-colors">
            {cat.name}
          </Link>
        </li>
      ))}
    </ul>
  )
}
