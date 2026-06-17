'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'

const MAIN_NAV = [
  { href: '/admin',              label: 'Dashboard',    icon: '▦' },
  { href: '/admin/citas',        label: 'Citas',        icon: '◷' },
  { href: '/admin/contabilidad', label: 'Contabilidad', icon: '◈' },
  { href: '/admin/auditoria',    label: 'Auditoría',    icon: '◎' },
]

// Grouped under "Configuración"
const CONFIG_NAV = [
  { href: '/admin/clientes',  label: 'Clientes',  icon: '◉' },
  { href: '/admin/servicios', label: 'Servicios', icon: '✦' },
  { href: '/admin/horarios',  label: 'Horarios',  icon: '◻' },
  { href: '/admin/galeria',   label: 'Galería',   icon: '◫' },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)

  // Close the mobile drawer whenever the route changes
  useEffect(() => { setOpen(false) }, [pathname])

  function renderNavItem(item: { href: string; label: string; icon: string }) {
    const active =
      pathname === item.href ||
      (item.href !== '/admin' && pathname.startsWith(item.href))
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 px-3 py-3 text-sm transition-colors border-l-2 pl-[10px] ${
          active
            ? 'bg-gold/10 text-gold border-gold'
            : 'text-white/40 hover:text-white hover:bg-white/5 border-transparent'
        }`}
      >
        <span className="w-4 text-center">{item.icon}</span>
        {item.label}
      </Link>
    )
  }

  return (
    <>
      {/* Mobile top bar with hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-ink border-b border-white/10
                      flex items-center gap-3 px-4">
        <button onClick={() => setOpen(true)} aria-label="Abrir menú"
          className="text-gold text-2xl leading-none">≡</button>
        <span className="logo-script text-gold text-xl leading-none">Valentina Jimenez</span>
      </div>

      {/* Backdrop (mobile) */}
      {open && (
        <div className="md:hidden fixed inset-0 z-40 bg-ink/50 backdrop-blur-sm"
          onClick={() => setOpen(false)} aria-hidden />
      )}

      <aside
        className={`bg-ink border-r border-white/10 flex flex-col shrink-0
                    w-64 md:w-56 min-h-screen
                    fixed md:static inset-y-0 left-0 z-50
                    transform transition-transform duration-300 ease-in-out
                    ${open ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        <div className="px-6 py-6 border-b border-white/10 flex items-start justify-between">
          <div>
            <Link href="/" target="_blank" className="block">
              <p className="logo-script text-gold text-2xl leading-none">
                Valentina Jimenez
              </p>
              <span className="logo-studio text-white/70 text-[0.5rem] mt-1 block">Beauty Studio</span>
            </Link>
            <p className="text-[10px] text-white/20 mt-2 tracking-widest uppercase">Panel admin</p>
          </div>
          {/* Close button (mobile) */}
          <button onClick={() => setOpen(false)} aria-label="Cerrar menú"
            className="md:hidden text-white/40 hover:text-white text-2xl leading-none">×</button>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <div className="space-y-0.5">
            {MAIN_NAV.map(renderNavItem)}
          </div>

          <p className="px-3 mt-5 mb-1.5 text-[10px] tracking-widest uppercase text-white/25">
            Configuración
          </p>
          <div className="space-y-0.5">
            {CONFIG_NAV.map(renderNavItem)}
          </div>
        </nav>

        <div className="px-4 py-5 border-t border-white/10">
          <p className="text-xs text-white/30 truncate mb-3">{session?.user?.email}</p>
          <button
            onClick={() => signOut({ callbackUrl: '/admin/login' })}
            className="text-xs text-white/30 hover:text-gold transition-colors"
          >
            Cerrar sesi&oacute;n &rarr;
          </button>
        </div>
      </aside>
    </>
  )
}
