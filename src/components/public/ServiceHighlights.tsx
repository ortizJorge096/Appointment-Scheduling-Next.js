// src/components/public/ServiceHighlights.tsx
// Specialty strip with gold-ring icons — mirrors the 5 services from the logo banner.
import Link from 'next/link'
import { SERVICE_HIGHLIGHTS } from './ServiceIcons'

export default function ServiceHighlights() {
  return (
    <section className="bg-ink py-12 border-t border-white/5">
      <div className="max-w-5xl mx-auto px-6 lg:px-10">
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-y-8 gap-x-4">
          {SERVICE_HIGHLIGHTS.map(({ label, Icon }) => (
            <li key={label} className="flex flex-col items-center text-center gap-3">
              <Link
                href="/agendar"
                aria-label={label}
                className="svc-icon-ring w-16 h-16 transition-transform duration-200 hover:-translate-y-1 hover:border-gold"
              >
                <Icon className="w-8 h-8" />
              </Link>
              <span className="text-[0.7rem] tracking-widest uppercase text-white/70">
                {label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
