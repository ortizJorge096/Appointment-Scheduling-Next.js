'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { hasPermission, type Permission } from '@/lib/permissions'

interface NavItem { href: string; label: string; icon: string; perm: Permission }
interface NavGroup { id: string; label: string; defaultOpen: boolean; items: NavItem[] }

// Grouped navigation. Routes and permissions are unchanged — only the visual
// grouping is new. Each item stays gated by its permission, and a whole group
// hides when the role can't see any of its items.
const GROUPS: NavGroup[] = [
  {
    id: 'operacion', label: 'Operación', defaultOpen: true,
    items: [
      { href: '/admin',              label: 'Dashboard',    icon: '▦', perm: 'metricas:ver' },
      { href: '/admin/citas',        label: 'Citas',        icon: '◷', perm: 'citas:ver' },
      { href: '/admin/clientes',     label: 'Clientes',     icon: '◉', perm: 'clientes:ver' },
      { href: '/admin/contabilidad', label: 'Contabilidad', icon: '◈', perm: 'contabilidad:ver' },
    ],
  },
  {
    id: 'studio', label: 'Studio', defaultOpen: true,
    items: [
      { href: '/admin/servicios',     label: 'Servicios',     icon: '✦', perm: 'servicios:ver' },
      { href: '/admin/profesionales', label: 'Profesionales', icon: '☆', perm: 'servicios:ver' },
      { href: '/admin/horarios',      label: 'Horarios',      icon: '◻', perm: 'horarios:ver' },
      { href: '/admin/galeria',       label: 'Galería',       icon: '◫', perm: 'galeria:ver' },
      { href: '/admin/testimonios',   label: 'Testimonios',   icon: '❝', perm: 'testimonios:ver' },
    ],
  },
  {
    id: 'sistema', label: 'Sistema', defaultOpen: false,
    items: [
      { href: '/admin/usuarios',  label: 'Usuarios',      icon: '⚿', perm: 'admins:gestionar' },
      { href: '/admin/auditoria', label: 'Auditoría',     icon: '◎', perm: 'auditoria:ver' },
      { href: '/admin/sitio',     label: 'Configuración', icon: '▤', perm: 'configuracion:ver' },
    ],
  },
]

const STORAGE_KEY = 'admin.sidebar.groups'

export default function AdminSidebar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const role = (session?.user as { role?: string } | undefined)?.role
  const [open, setOpen] = useState(false) // mobile drawer
  const [pendingTestimonials, setPendingTestimonials] = useState(0)

  // Per-group expand/collapse. Starts from the defaults so SSR and the first
  // client render match; the persisted state is merged in after mount.
  const [groupOpen, setGroupOpen] = useState<Record<string, boolean>>(
    () => Object.fromEntries(GROUPS.map((g) => [g.id, g.defaultOpen]))
  )

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) setGroupOpen((prev) => ({ ...prev, ...JSON.parse(raw) }))
    } catch { /* ignore malformed storage */ }
  }, [])

  // Close the mobile drawer whenever the route changes
  useEffect(() => { setOpen(false) }, [pathname])

  // Pending-testimonials count for the moderation badge.
  useEffect(() => {
    fetch('/api/testimonials?status=PENDING')
      .then((r) => r.json())
      .then((json) => { if (json.success && Array.isArray(json.data)) setPendingTestimonials(json.data.length) })
      .catch(() => {})
  }, [pathname])

  const isActiveHref = (href: string) =>
    pathname === href || (href !== '/admin' && pathname.startsWith(href))

  function toggleGroup(id: string) {
    setGroupOpen((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
  }

  function renderNavItem(item: NavItem) {
    const active = isActiveHref(item.href)
    const badge = item.href === '/admin/testimonios' && pendingTestimonials > 0 ? pendingTestimonials : null
    return (
      <Link
        key={item.href}
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2.5 text-sm transition-colors border-l-2 pl-[10px] ${
          active
            ? 'bg-gold/10 text-gold border-gold'
            : 'text-white/55 hover:text-white hover:bg-white/5 border-transparent'
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

  function renderGroup(group: NavGroup) {
    const items = group.items.filter((i) => hasPermission(role, i.perm))
    if (items.length === 0) return null // hide groups with nothing visible for this role

    const hasActive = items.some((i) => isActiveHref(i.href))
    const expanded  = hasActive || groupOpen[group.id] // the active group is always open

    return (
      <div key={group.id} className="mb-1">
        <button
          type="button"
          onClick={() => toggleGroup(group.id)}
          aria-expanded={expanded}
          className={`w-full flex items-center gap-2 px-3 mt-4 mb-1 text-[10px] tracking-widest uppercase
                      transition-colors ${hasActive ? 'text-gold' : 'text-white/55 hover:text-white/80'}`}
        >
          <span aria-hidden="true" className={`text-[10px] leading-none transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}>▶</span>
          <span className="flex-1 text-left">{group.label}</span>
        </button>

        {/* Smooth collapse via grid-rows 0fr↔1fr — no height measuring needed. */}
        <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
          <div className="overflow-hidden">
            <div className="space-y-0.5">
              {items.map(renderNavItem)}
            </div>
          </div>
        </div>
      </div>
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

      {/* invisible when the mobile drawer is closed, not just translated away:
          transform moves it off-screen but leaves all 19 controls in the tab
          order, so keyboard and screen-reader users walk the whole nav before
          reaching the page. visibility:hidden drops them; md:visible restores
          the static desktop sidebar. */}
      <aside
        className={`bg-ink border-r border-white/10 flex flex-col shrink-0
                    w-64 md:w-56 min-h-screen
                    fixed md:static inset-y-0 left-0 z-50
                    transform transition-[transform,visibility] duration-300 ease-in-out
                    ${open ? 'translate-x-0 visible' : '-translate-x-full invisible'} md:translate-x-0 md:visible`}
      >
        <div className="px-6 py-6 border-b border-white/10 flex items-start justify-between">
          <div>
            <Link href="/" target="_blank" className="block">
              <p className="logo-script text-gold text-2xl leading-none">
                Valentina Jimenez
              </p>
              <span className="logo-studio text-white/70 text-[0.5rem] mt-1 block">Beauty Studio</span>
            </Link>
            <p className="text-[10px] text-white/50 mt-2 tracking-widest uppercase">Panel admin</p>
          </div>
          {/* Close button (mobile) */}
          <button onClick={() => setOpen(false)} aria-label="Cerrar menú"
            className="md:hidden text-white/40 hover:text-white text-2xl leading-none min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2">×</button>
        </div>

        <nav className="flex-1 px-3 py-4 overflow-y-auto">
          {GROUPS.map(renderGroup)}
        </nav>

        <div className="px-4 py-5 border-t border-white/10">
          <p className="text-xs text-white/55 truncate mb-3">{session?.user?.email}</p>
          <Link href="/admin/perfil"
            className="block text-xs text-white/55 hover:text-gold transition-colors mb-2">
            Mi perfil
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: '/admin/login' })}
            className="text-xs text-white/55 hover:text-gold transition-colors"
          >
            Cerrar sesi&oacute;n &rarr;
          </button>
        </div>
      </aside>
    </>
  )
}
