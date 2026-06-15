// src/lib/audit.ts
// Helper para registrar entradas en el log de auditoría.
// Se llama explícitamente desde cada API route que modifique datos.

import { prisma } from '@/lib/prisma'
import { AuditAction, AuditEntity } from '@prisma/client'

export type { AuditAction, AuditEntity }

interface AuditParams {
  action:    AuditAction
  entity:    AuditEntity
  entityId:  string
  userEmail?: string
  ip?:        string
  metadata?:  Record<string, unknown>
}

/**
 * Crea una entrada en el log de auditoría.
 * No lanza excepción — un fallo de auditoría no debe romper la operación principal.
 */
export async function audit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({ data: params })
  } catch (err) {
    // Loguear en servidor pero no propagar — la acción ya se completó
    console.error('[audit] Error registrando entrada de auditoría:', err)
  }
}

/**
 * Extrae la IP del cliente desde los headers de la request.
 * Respeta X-Forwarded-For (nginx-ingress / load balancer).
 */
export function getClientIp(request: Request): string | undefined {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return undefined
}
