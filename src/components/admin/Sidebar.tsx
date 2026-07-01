'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { hasPermission, type Permission } from '@/lib/permissions'

interface NavItem { href: string; label: string; icon: string; perm: Permission }

const MAIN_NAV: NavItem[] = [
  { href: '/admin',              label: 'Dashboard',    icon: '▦', perm: 'metricas:ver' },
  { href: '/admin/citas',        label: 'Citas',        icon: '◷', perm: 'citas:ver' },
  { href: '/admin/contabilidad', label: 'Contabilidad', icon: '◈', perm: 'contabilidad:ver' },
  { href: '/admin/auditoria',    label: 'Auditoría',    icon: '◎', perm: 'auditoria:ver' },
]

// Grouped under "Configuración"
const CONFIG_NAV: NavItem[] = [
  { href: '/admin/clientes',      label: 'Clientes',      icon: '◉', perm: 'clientes:ver' },
  { href: '/admin/servicios',     label: 'Servicios',     icon: '✦', perm: 'servicios:ver' },
  { href: '/admin/profesionales', label: 'Profesionales', icon: '☆', perm: 'servicios:ver' },
  { href: '/admin/horarios',      label: 'Horarios',      icon: '◻', perm: 'horarios:ver' },
  { href: '/admin/galeria',       label: 'Galería',       icon: '◫', perm: 'galeria:ver' },
  { href: '/admin/testimonios',   label: 'Testimonios',   icon: '❝', perm: 'testimonios:ver' },
  { href: '/admin/sitio',         label: 'Métricas',      icon: '▤', perm: 'configuracion:ver' },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = (session?.user as { role?: string } | undefined)?.role
  const [open, setOpen] = useState(false)
  const [pendingTestimonials, setPendingTestimonials] = useState(0)

  // Close the mobile drawer whenever the route changes
  useEffect(() => { setOpen(false) }, [pathname])

  // Pending-testimonials count for the moderation badge.
  useEffect(() => {
    fetch('/api/testimonials?status=PENDING')
      .then((r) => r.json())
      .then((json) => { if (json.success && Array.isArray(json.data)) setPendingTestimonials(json.data.length) })
      .catch(() => {})
  }, [pathname])

  function renderNavItem(item: NavItem) {
    const active =
      pathname === item.href ||
      (item.href !== '/admin' && pathname.startsWith(item.href))
    const badge = item.href === '/admin/testimonios' && pendingTestimonials > 0 ? pendingTestimonials : null
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
        <span className="flex-1">{item.label}</span>
        {badge !== null && (
          <span className="ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5
                           rounded-full bg-gold text-ink text-[11px] font-semibold">
            {badge}
          </span>
        )}
      </Link>
    )
  }

  return (
    <>
      {/* Mobile top bar with hamburger */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-14 bg-ink border-b border-white/10
                      flex items-center gap-3 px-4">
        <button onClick={() => setOpen(true)} aria-label="Abrir menú"
          className="text-gold text-2xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center -ml-2">≡</button>
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
            className="md:hidden text-white/40 hover:text-white text-2xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2">×</button>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          <div className="space-y-0.5">
            {MAIN_NAV.filter((i) => hasPermission(role, i.perm)).map(renderNavItem)}
          </div>

          <p className="px-3 mt-5 mb-1.5 text-[10px] tracking-widest uppercase text-white/25">
            Configuración
          </p>
          <div className="space-y-0.5">
            {CONFIG_NAV.filter((i) => hasPermission(role, i.perm)).map(renderNavItem)}
            {/* Admin management — requires the admins:gestionar permission (SUPER_ADMIN) */}
            {hasPermission(role, 'admins:gestionar') &&
              renderNavItem({ href: '/admin/usuarios', label: 'Usuarios', icon: '⚿', perm: 'admins:gestionar' })}
          </div>
        </nav>

        <div className="px-4 py-5 border-t border-white/10">
          <p className="text-xs text-white/30 truncate mb-3">{session?.user?.email}</p>
          <Link href="/admin/perfil"
            className="block text-xs text-white/30 hover:text-gold transition-colors mb-2">
            Mi perfil
          </Link>
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
