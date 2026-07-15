import Link from 'next/link'
import { STUDIO, MAILTO_URL, INSTAGRAM_URL, TIKTOK_URL } from '@/lib/config'
import FooterServiceLinks from './FooterServiceLinks'
import FooterTagline from './FooterTagline'
import WhatsAppLink from './WhatsAppLink'

export default function Footer() {
  return (
    <footer className="bg-ink border-t border-white/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12
                      grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
        <div>
          <Link href="/" className="flex flex-col leading-none" aria-label={STUDIO.name}>
            <span className="logo-script text-gold text-3xl">{STUDIO.shortName}</span>
            <span className="logo-studio text-white/70 text-[0.55rem] mt-1">{STUDIO.tagline}</span>
          </Link>
          <FooterTagline />
        </div>

        <div>
          <p className="text-xs text-gold uppercase tracking-widest mb-4">Servicios</p>
          <FooterServiceLinks />
        </div>

        <div>
          <p className="text-xs text-gold uppercase tracking-widest mb-4">Navegación</p>
          <ul className="space-y-2.5">
            {[
              { label: 'Servicios',    href: '/#servicios' },
              { label: 'Galería',     href: '/#galeria'   },
              { label: 'Testimonios', href: '/#testimonios' },
              { label: 'Nosotros',    href: '/#nosotros'  },
              { label: 'FAQ',         href: '/#faq'       },
              { label: 'Agendar cita',href: '/agendar'   },
            ].map((l) => (
              <li key={l.href}>
                <Link href={l.href}
                  className="text-sm text-white/55 hover:text-gold transition-colors">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs text-gold uppercase tracking-widest mb-4">Contacto</p>
          <ul className="space-y-2.5 text-sm text-white/55">
            <li>{STUDIO.address}</li>
            <li>
              <WhatsAppLink className="hover:text-gold transition-colors">
                {STUDIO.phone}
              </WhatsAppLink>
            </li>
            <li>
              <a href={MAILTO_URL}
                className="hover:text-gold transition-colors">
                {STUDIO.email}
              </a>
            </li>
            <li className="flex items-center gap-4 pt-2">
              <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer"
                className="text-white/60 hover:text-gold transition-colors text-xs tracking-widest uppercase">
                Instagram
              </a>
              <a href={TIKTOK_URL} target="_blank" rel="noreferrer"
                className="text-white/60 hover:text-gold transition-colors text-xs tracking-widest uppercase">
                TikTok
              </a>
            </li>
          </ul>
        </div>
      </div>

      {/* Copyright only, centered — never under the floating WhatsApp button (which sits bottom-right) */}
      <div className="border-t border-white/[0.06] px-6 py-6 text-center">
        <p className="text-xs text-white/50">
          © {new Date().getFullYear()} {STUDIO.name}
        </p>
      </div>
    </footer>
  )
}
