'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { STUDIO } from '@/lib/config'

const SECTIONS = [
  { label: 'Servicios', anchor: 'servicios' },
  { label: 'Galería',   anchor: 'galeria'   },
  { label: 'Nosotros',  anchor: 'nosotros'  },
  { label: 'FAQ',       anchor: 'faq'       },
  { label: 'Contacto',  anchor: 'contacto'  },
]

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname    = usePathname()
  const isHome      = pathname === '/'
  const isOnBooking = pathname === '/agendar'

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  function navHref(anchor: string) {
    return isHome ? `#${anchor}` : `/#${anchor}`
  }

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled
        ? 'bg-beige/95 backdrop-blur-md border-b border-beige-dark shadow-sm'
        : 'bg-beige/80 backdrop-blur-sm'
    }`}>
      <div className="max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-between">

        <Link href="/" className="flex flex-col leading-none" aria-label={STUDIO.name}>
          <span className="logo-script text-gold text-2xl sm:text-[1.7rem]">
            {STUDIO.shortName}
          </span>
          <span className="logo-studio text-ink text-[0.5rem] sm:text-[0.55rem] mt-0.5">
            {STUDIO.tagline}
          </span>
        </Link>

        <ul className="hidden md:flex items-center gap-8">
          {SECTIONS.map((s) => (
            <li key={s.anchor}>
              <Link href={navHref(s.anchor)}
                className="text-xs font-medium tracking-widest uppercase text-ink-muted
                           hover:text-gold transition-colors duration-150">
                {s.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden md:block">
          {!isOnBooking && (
            <Link href="/agendar" className="btn-cta">Agendar cita</Link>
          )}
        </div>

        <button className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMenuOpen(!menuOpen)} aria-label="Menú">
          <span className={`block w-5 h-px bg-ink transition-all ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block w-5 h-px bg-ink transition-all ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-px bg-ink transition-all ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-beige border-t border-beige-dark px-6 py-6 flex flex-col gap-4">
          {SECTIONS.map((s) => (
            <Link key={s.anchor} href={navHref(s.anchor)}
              className="text-sm text-ink-muted uppercase tracking-widest hover:text-gold transition-colors"
              onClick={() => setMenuOpen(false)}>
              {s.label}
            </Link>
          ))}
          {!isOnBooking && (
            <Link href="/agendar" className="btn-cta text-center mt-2"
              onClick={() => setMenuOpen(false)}>
              Agendar cita
            </Link>
          )}
        </div>
      )}
    </nav>
  )
}
