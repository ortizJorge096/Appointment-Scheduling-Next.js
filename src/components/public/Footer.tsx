import Link from 'next/link'
import { STUDIO, WHATSAPP_URL, MAILTO_URL, INSTAGRAM_URL, TIKTOK_URL } from '@/lib/config'

export default function Footer() {
  return (
    <footer className="bg-ink border-t border-white/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 py-12
                      grid grid-cols-1 sm:grid-cols-3 gap-10">
        <div>
          <Link href="/" className="font-serif text-lg text-white font-light">
            {STUDIO.shortName}{' '}
            <em className="text-gold italic font-light">{STUDIO.tagline}</em>
          </Link>
          <p className="text-white/30 text-xs mt-3 leading-relaxed">
            Uñas, pestañas y cejas en {STUDIO.city}.<br />Agenda tu cita en línea.
          </p>
        </div>

        <div>
          <p className="text-xs text-gold/50 uppercase tracking-widest mb-4">Navegación</p>
          <ul className="space-y-2.5">
            {[
              { label: 'Servicios',    href: '/#servicios' },
              { label: 'Galería',     href: '/#galeria'   },
              { label: 'Nosotros',    href: '/#nosotros'  },
              { label: 'FAQ',         href: '/#faq'       },
              { label: 'Agendar cita',href: '/agendar'   },
            ].map((l) => (
              <li key={l.href}>
                <Link href={l.href}
                  className="text-sm text-white/40 hover:text-gold transition-colors">
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs text-gold/50 uppercase tracking-widest mb-4">Contacto</p>
          <ul className="space-y-2.5 text-sm text-white/40">
            <li>{STUDIO.address}</li>
            <li>
              <a href={WHATSAPP_URL} target="_blank" rel="noreferrer"
                className="hover:text-gold transition-colors">
                {STUDIO.phone}
              </a>
            </li>
            <li>
              <a href={MAILTO_URL}
                className="hover:text-gold transition-colors">
                {STUDIO.email}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/[0.06] px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-xs text-white/20">
          © {new Date().getFullYear()} {STUDIO.name}
        </p>
        <div className="flex items-center gap-4">
          <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer"
            className="text-white/30 hover:text-gold transition-colors text-xs tracking-widest uppercase">
            Instagram
          </a>
          <a href={TIKTOK_URL} target="_blank" rel="noreferrer"
            className="text-white/30 hover:text-gold transition-colors text-xs tracking-widest uppercase">
            TikTok
          </a>
        </div>
      </div>
    </footer>
  )
}
