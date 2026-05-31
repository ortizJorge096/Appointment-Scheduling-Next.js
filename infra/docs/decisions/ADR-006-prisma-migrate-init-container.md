# ADR-006 — Migraciones Prisma vía init container

**Status:** Accepted · **Date:** 2026-05-28

## Contexto

Cada deploy puede traer nuevas migraciones (`prisma/migrations/...`)
que deben aplicarse contra RDS antes de que el app container empiece
a servir.

Opciones:

1. **Init container** corriendo `npx prisma migrate deploy`.
2. **K8s Job** separado lanzado por el pipeline.
3. **App container** corre migraciones en startup.
4. **GitHub Actions** corre migraciones desde el runner antes del deploy.

## Decisión

**Init container** dentro del mismo Deployment.

## Por qué

| Aspecto | Init container (elegido) | K8s Job | App startup | CI |
|---|---|---|---|---|
| Atomicidad con el deploy | sí (mismo rollout) | no | sí | no |
| Race condition multi-réplica | NO — corre 1 vez por pod, pero `migrate deploy` es idempotente | NO | SÍ (cada réplica ejecuta) | NO |
| Acceso a la red de la BD | sí (mismo SG) | sí | sí | NO (CI runner no entra al VPC) |
| Visibilidad en rollouts | sí (`kubectl describe`) | requiere job lookup | logs del pod | log de Actions |
| Bloquea liveness probe si falla | sí, pod queda en `Init:CrashLoopBackOff` (deseado) | no | sí | no |

`prisma migrate deploy` lee la lista de migraciones aplicadas en la
tabla `_prisma_migrations` y solo aplica las pendientes — completamente
idempotente, así que varias réplicas corriéndolo en paralelo es seguro
(la primera gana, las otras no-op).

## Detalles de implementación

```yaml
initContainers:
  - name: prisma-migrate
    image: appointment-scheduling:placeholder   # MISMA imagen que el app
    command: ["sh", "-c"]
    args:
      - npx --no-install prisma migrate deploy --schema=./prisma/schema.prisma
    envFrom:
      - secretRef:
          name: appointment-scheduling-secret    # DATABASE_URL
```

Usar la misma imagen evita drift entre versión del schema y versión
del cliente Prisma.

## Failure modes

- **DB inaccessible:** init container falla, pod queda en
  `Init:Error`, rollout no avanza, kubectl reporta el error.
- **Migración rota:** misma cosa — el rollback es:
  `kubectl rollout undo deployment/appointment-scheduling`.
- **Migración irreversible aplicada con bugs:** `prisma migrate resolve`
  manual desde una shell del nodo.
