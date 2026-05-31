'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

const NAV = [
  { href: '/admin',           label: 'Dashboard', icon: '▦' },
  { href: '/admin/citas',     label: 'Citas',     icon: '◷' },
  { href: '/admin/servicios', label: 'Servicios', icon: '✦' },
  { href: '/admin/galeria',   label: 'Galería',   icon: '◫' },
  { href: '/admin/horarios',  label: 'Horarios',  icon: '◻' },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()

  return (
    <aside className="w-56 min-h-screen bg-ink border-r border-white/10 flex flex-col shrink-0">
      <div className="px-6 py-6 border-b border-white/10">
        <Link href="/" target="_blank" className="block">
          <p className="font-serif text-base text-white font-light leading-tight">
            Valentina Jimenez
          </p>
          <em className="text-gold text-xs italic font-light not-italic">Beauty Studio</em>
        </Link>
        <p className="text-[10px] text-white/20 mt-2 tracking-widest uppercase">Panel admin</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map((item) => {
          const active = pathname === item.href ||
            (item.href !== '/admin' && pathname.startsWith(item.href))
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 text-sm transition-colors
                border-l-2 pl-[10px]
                ${active
                  ? 'bg-gold/10 text-gold border-gold'
                  : 'text-white/40 hover:text-white hover:bg-white/5 border-transparent'}`}>
              <span className="w-4 text-center">{item.icon}</span>
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="px-4 py-5 border-t border-white/10">
        <p className="text-xs text-white/30 truncate mb-3">{session?.user?.email}</p>
        <button onClick={() => signOut({ callbackUrl: '/admin/login' })}
          className="text-xs text-white/30 hover:text-gold transition-colors">
          Cerrar sesión →
        </button>
      </div>
    </aside>
  )
}
