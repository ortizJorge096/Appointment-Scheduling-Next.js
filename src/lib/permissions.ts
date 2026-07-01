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
