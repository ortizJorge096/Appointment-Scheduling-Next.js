// src/lib/permissions.ts
// Permission-based access control. Permissions are a pure function of the admin's
// role — the session callback already re-reads `role` from the DB each request,
// so resolving permissions here means ZERO extra queries AND role changes take
// effect immediately (no forced re-login).

export const PERMISSIONS = {
  // Citas
  'citas:ver':      'Ver listado y detalle de citas',
  'citas:crear':    'Crear citas manuales',
  'citas:editar':   'Editar citas existentes',
  'citas:cancelar': 'Cancelar citas',
  'citas:pago':     'Registrar y editar pagos',

  // Clientes
  'clientes:ver':    'Ver listado de clientes',
  'clientes:editar': 'Editar datos de clientes',

  // Servicios y categorías (incluye profesionales del catálogo)
  'servicios:ver':    'Ver servicios y categorías',
  'servicios:editar': 'Crear, editar y eliminar servicios',

  // Horarios
  'horarios:ver':    'Ver configuración de horarios',
  'horarios:editar': 'Editar horarios y fechas bloqueadas',

  // Galería
  'galeria:ver':    'Ver galería',
  'galeria:editar': 'Subir y eliminar imágenes',

  // Testimonios
  'testimonios:ver':     'Ver testimonios',
  'testimonios:editar':  'Crear y editar testimonios',
  'testimonios:moderar': 'Aprobar y rechazar testimonios',

  // Métricas y contabilidad
  'metricas:ver':     'Ver dashboard y métricas',
  'contabilidad:ver': 'Ver reportes de ingresos',

  // Auditoría
  'auditoria:ver': 'Ver y exportar el log de auditoría',

  // Configuración general (VIP, landing, ajustes de reserva)
  'configuracion:ver':    'Ver configuración general',
  'configuracion:editar': 'Editar configuración general',

  // Admins (solo Super Admin)
  'admins:gestionar': 'Crear, editar y desactivar admins',
} as const

export type Permission = keyof typeof PERMISSIONS

export const ROLES = ['SUPER_ADMIN', 'ADMIN', 'RECEPCIONISTA', 'SOLO_LECTURA'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN:   'Super administrador',
  ADMIN:         'Administrador',
  RECEPCIONISTA: 'Recepcionista',
  SOLO_LECTURA:  'Solo lectura',
}

const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as Permission[]

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,

  ADMIN: [
    'citas:ver', 'citas:crear', 'citas:editar', 'citas:cancelar', 'citas:pago',
    'clientes:ver', 'clientes:editar',
    'servicios:ver', 'servicios:editar',
    'horarios:ver', 'horarios:editar',
    'galeria:ver', 'galeria:editar',
    'testimonios:ver', 'testimonios:editar', 'testimonios:moderar',
    'metricas:ver', 'contabilidad:ver',
    'auditoria:ver',
    'configuracion:ver', 'configuracion:editar',
  ],

  RECEPCIONISTA: [
    'citas:ver', 'citas:crear', 'citas:editar',
    'clientes:ver',
    'servicios:ver',
    'horarios:ver',
    'metricas:ver',
  ],

  SOLO_LECTURA: [
    'citas:ver',
    'clientes:ver',
    'servicios:ver',
    'metricas:ver',
    'contabilidad:ver',
  ],
}

/** Pure permission check. Unknown/undefined role → no access. */
export function hasPermission(role: string | undefined | null, permission: Permission): boolean {
  if (!role || !(role in ROLE_PERMISSIONS)) return false
  return ROLE_PERMISSIONS[role as Role].includes(permission)
}

// One-line summary of each role (shown when assigning it).
export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  SUPER_ADMIN:   'Acceso total, incluida la gestión de administradores.',
  ADMIN:         'Operación diaria completa; no gestiona administradores.',
  RECEPCIONISTA: 'Gestión de citas y clientes; sin pagos, cancelaciones ni configuración.',
  SOLO_LECTURA:  'Ver agenda e informes, sin modificar nada.',
}

const AREA_LABELS: Record<string, string> = {
  citas: 'Citas', clientes: 'Clientes', servicios: 'Servicios', horarios: 'Horarios',
  galeria: 'Galería', testimonios: 'Testimonios', metricas: 'Métricas',
  contabilidad: 'Contabilidad', auditoria: 'Auditoría', configuracion: 'Configuración',
  admins: 'Administradores',
}
const ACTION_LABELS: Record<string, string> = {
  ver: 'ver', crear: 'crear', editar: 'editar', cancelar: 'cancelar',
  pago: 'pagos', moderar: 'moderar', gestionar: 'gestionar',
}

/** Human-readable capabilities of a role, grouped by area — derived from the
 *  single source of truth so the UI never drifts from the actual permissions. */
export function roleCapabilities(role: Role): { area: string; actions: string[] }[] {
  const byArea = new Map<string, string[]>()
  for (const perm of ROLE_PERMISSIONS[role]) {
    const [area, action] = perm.split(':')
    const list = byArea.get(area) ?? []
    list.push(ACTION_LABELS[action] ?? action)
    byArea.set(area, list)
  }
  return [...byArea.entries()].map(([area, actions]) => ({ area: AREA_LABELS[area] ?? area, actions }))
}
