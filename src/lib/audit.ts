// src/lib/audit.ts
// Helper to record entries in the audit log.
// Called explicitly from every API route that modifies data.

import { prisma } from '@/lib/prisma'
import { AuditAction, AuditEntity } from '@prisma/client'
import type { Prisma } from '@prisma/client'

export type { AuditAction, AuditEntity }

interface AuditParams {
  action:    AuditAction
  entity:    AuditEntity
  entityId:  string
  userEmail?: string
  ip?:        string
  metadata?:  Prisma.InputJsonValue
}

/**
 * Creates an entry in the audit log.
 * Never throws — an audit failure must not break the main operation.
 */
export async function audit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({ data: params as Prisma.AuditLogCreateInput })
  } catch (err) {
    // Log on the server but don't propagate — the action already completed
    console.error('[audit] Error registrando entrada de auditoría:', err)
  }
}

/**
 * Extracts the client IP from the request headers.
 * Honors X-Forwarded-For (nginx-ingress / load balancer).
 */
export function getClientIp(request: Request): string | undefined {
  const forwarded = request.headers?.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return undefined
}
