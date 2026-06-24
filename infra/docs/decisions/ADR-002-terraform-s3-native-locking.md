# ADR-002 — Terraform S3 native locking (sin DynamoDB)

**Status:** Accepted · **Date:** 2026-05-28

## Contexto

Necesitamos remote state para Terraform con locking concurrente
entre runs (local y CI). El patrón histórico es S3 + DynamoDB lock
table.

## Decisión

**Terraform >= 1.10 con `use_lockfile = true` en el backend S3.**
DynamoDB se elimina.

## Consecuencias

| Aspecto | S3 + DynamoDB | S3 nativo (elegido) |
|---|---|---|
| Recursos a mantener | 2 (bucket + tabla) | 1 (bucket) |
| Free Tier | DynamoDB 25 RCU + 25 WCU free | bucket 5GB free |
| Versión mínima de TF | cualquiera | >= 1.10 |
| Locking | atómico (DynamoDB conditional) | atómico (S3 If-None-Match) |
| Configuración | `dynamodb_table = ...` | `use_lockfile = true` |

Ambos enfoques garantizan el mismo nivel de atomicidad (HashiCorp
documentado). Eliminar DynamoDB reduce 1 servicio del blast radius
y nos mantiene cómodos dentro de Free Tier.

## Constraint

Cualquier ejecución de Terraform tiene que ser >= 1.10. CI ya valida
esta versión.
