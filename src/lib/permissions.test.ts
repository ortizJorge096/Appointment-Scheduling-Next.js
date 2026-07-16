// src/lib/permissions.test.ts
// The authorization core: the role→permission matrix. Pure functions, so these
// lock the exact boundaries each role may cross (and, crucially, may NOT).
import { describe, it, expect } from 'vitest'
import {
  hasPermission, ROLE_PERMISSIONS, PERMISSIONS, ROLES, roleCapabilities,
  type Permission,
} from './permissions'

const ALL = Object.keys(PERMISSIONS) as Permission[]

describe('hasPermission — denegación', () => {
  it('deniega con rol null/undefined/vacío/desconocido', () => {
    expect(hasPermission(null, 'citas:ver')).toBe(false)
    expect(hasPermission(undefined, 'citas:ver')).toBe(false)
    expect(hasPermission('', 'citas:ver')).toBe(false)
    expect(hasPermission('HACKER', 'citas:ver')).toBe(false)
    // Case-sensitive: una cuenta desactivada que perdió su rol no debe colarse.
    expect(hasPermission('super_admin', 'citas:ver')).toBe(false)
  })
})

describe('hasPermission — por rol', () => {
  it('SUPER_ADMIN tiene TODOS los permisos', () => {
    for (const p of ALL) expect(hasPermission('SUPER_ADMIN', p)).toBe(true)
  })

  it('solo SUPER_ADMIN puede gestionar admins', () => {
    expect(hasPermission('SUPER_ADMIN', 'admins:gestionar')).toBe(true)
    expect(hasPermission('ADMIN', 'admins:gestionar')).toBe(false)
    expect(hasPermission('RECEPCIONISTA', 'admins:gestionar')).toBe(false)
    expect(hasPermission('SOLO_LECTURA', 'admins:gestionar')).toBe(false)
  })

  it('ADMIN: operación diaria completa pero NO gestiona admins', () => {
    expect(hasPermission('ADMIN', 'citas:pago')).toBe(true)
    expect(hasPermission('ADMIN', 'citas:cancelar')).toBe(true)
    expect(hasPermission('ADMIN', 'contabilidad:editar')).toBe(true)
    expect(hasPermission('ADMIN', 'testimonios:moderar')).toBe(true)
    expect(hasPermission('ADMIN', 'configuracion:editar')).toBe(true)
    expect(hasPermission('ADMIN', 'admins:gestionar')).toBe(false)
  })

  it('RECEPCIONISTA: agenda + alta de citas, sin pagos/cancelaciones/contabilidad/config', () => {
    expect(hasPermission('RECEPCIONISTA', 'citas:crear')).toBe(true)
    expect(hasPermission('RECEPCIONISTA', 'citas:editar')).toBe(true)
    expect(hasPermission('RECEPCIONISTA', 'citas:cancelar')).toBe(false)
    expect(hasPermission('RECEPCIONISTA', 'citas:pago')).toBe(false)
    expect(hasPermission('RECEPCIONISTA', 'clientes:editar')).toBe(false)
    expect(hasPermission('RECEPCIONISTA', 'servicios:editar')).toBe(false)
    expect(hasPermission('RECEPCIONISTA', 'contabilidad:ver')).toBe(false)
    expect(hasPermission('RECEPCIONISTA', 'configuracion:editar')).toBe(false)
  })

  it('SOLO_LECTURA: no puede ESCRIBIR nada, pero ve contabilidad (divergencia intencional vs recepción)', () => {
    // Todo permiso que no sea ":ver" debe estar negado para solo-lectura.
    for (const p of ALL.filter((x) => !x.endsWith(':ver'))) {
      expect(hasPermission('SOLO_LECTURA', p)).toBe(false)
    }
    expect(hasPermission('SOLO_LECTURA', 'contabilidad:ver')).toBe(true)
    expect(hasPermission('SOLO_LECTURA', 'metricas:ver')).toBe(true)
    // Recepción NO ve contabilidad aunque solo-lectura sí: los roles no son una cadena de supersets.
    expect(hasPermission('RECEPCIONISTA', 'contabilidad:ver')).toBe(false)
  })
})

describe('ROLE_PERMISSIONS — invariantes de integridad', () => {
  it('cada permiso asignado existe en PERMISSIONS (sin typos/drift)', () => {
    for (const role of ROLES) {
      for (const p of ROLE_PERMISSIONS[role]) expect(ALL).toContain(p)
    }
  })

  it('ningún rol tiene permisos duplicados', () => {
    for (const role of ROLES) {
      const list = ROLE_PERMISSIONS[role]
      expect(new Set(list).size).toBe(list.length)
    }
  })
})

describe('roleCapabilities', () => {
  it('agrupa por área desde la matriz real y no inventa áreas', () => {
    const areas = roleCapabilities('SOLO_LECTURA').map((c) => c.area)
    expect(areas).toContain('Citas')
    expect(areas).toContain('Contabilidad')
    expect(areas).not.toContain('Administradores')
  })
})
