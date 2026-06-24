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
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-ink/90 backdrop-blur-md ${
      scrolled ? 'shadow-md' : ''
    }`}>
      <div className="relative max-w-7xl mx-auto px-6 lg:px-10 h-16 flex items-center justify-center gap-1.5">

        <Link href="/" className="hidden lg:flex absolute left-6 lg:left-10 flex-col leading-none" aria-label={STUDIO.name}>
          <span className="logo-script text-gold-light text-2xl">
            {STUDIO.shortName}
          </span>
          <span className="logo-studio text-white/70 text-[0.5rem] mt-0.5">
            {STUDIO.tagline}
          </span>
        </Link>

        <ul className="hidden md:flex items-center gap-1.5">
          {SECTIONS.map((s) => (
            <li key={s.anchor}>
              <Link href={navHref(s.anchor)}
                className="text-[13px] font-semibold tracking-wide rounded-full px-4 py-2.5
                           text-[#cfc6b4] hover:text-white transition-all duration-200">
                {s.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="hidden md:block ml-2">
          {!isOnBooking && (
            <Link href="/agendar"
              className="text-[13px] font-semibold tracking-wide rounded-full px-4 py-2.5
                         bg-gradient-to-br from-gold-light to-gold text-ink transition-all duration-200">
              Agendar cita
            </Link>
          )}
        </div>

        <button className="md:hidden absolute right-2 min-w-[44px] min-h-[44px] flex flex-col items-center justify-center gap-1.5"
          onClick={() => setMenuOpen(!menuOpen)} aria-label="Menú">
          <span className={`block w-5 h-px bg-white transition-all ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block w-5 h-px bg-white transition-all ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-5 h-px bg-white transition-all ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {menuOpen && (
        <div className="md:hidden bg-ink border-t border-white/10 px-6 py-6 flex flex-col gap-2">
          {SECTIONS.map((s) => (
            <Link key={s.anchor} href={navHref(s.anchor)}
              className="text-sm text-[#cfc6b4] uppercase tracking-widest hover:text-white transition-colors px-4 py-2.5 rounded-full"
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
