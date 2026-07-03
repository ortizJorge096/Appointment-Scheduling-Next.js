# valentinajimenez

Sistema de agendamiento de citas para un estudio de belleza: reserva pública
con disponibilidad en tiempo real, y panel de administración con roles,
permisos granulares, auditoría y contabilidad.

**Stack**: Next.js (App Router) + TypeScript + Prisma/PostgreSQL + NextAuth +
Tailwind. Ver [`STRUCTURE.md`](./STRUCTURE.md) para el árbol completo y
[`CONTRIBUTING.md`](./CONTRIBUTING.md) para los estándares de código.

## Arquitectura

```
Internet → Route53 → k3s/EC2 (Next.js) → RDS PostgreSQL
                                        → SES (emails)
                                        → S3 (imágenes)
```

> Producción corre en **k3s/Kubernetes** (manifiestos en `infra/k8s/`), aprovisionada con Terraform (`infra/terraform/`). El deploy es automático vía GitHub Actions (build → ECR → k8s). Detalle completo, ADRs y costos en [`infra/README.md`](./infra/README.md).

---

## Desarrollo local (Docker Compose)

Levanta Postgres + la app + un contenedor que migra y siembra la base, todo en local:

```bash
cp .env.example .env.local   # completa los secretos
docker compose up --build
```

- App en `http://localhost:3000`; Postgres en `127.0.0.1:5432` (para Prisma Studio).
- Las credenciales de la DB en el compose son **solo de desarrollo** (override con `.env.local`).
- ⚠️ Este compose **no** es para producción — prod va por k8s.

Alternativa sin Docker: `npm install && npx prisma migrate dev && npm run db:seed && npm run dev`
(requiere Postgres corriendo por tu cuenta). Ver [`STRUCTURE.md`](./STRUCTURE.md#comandos-de-inicio) para el resto de comandos (tests, lint, build).

---

## Deploy a AWS

El deploy de producción y desarrollo remoto (Terraform + k3s + CI/CD) está
documentado en [`infra/README.md`](./infra/README.md) — no lo dupliques aquí.
Ese documento cubre: pre-requisitos, bootstrap de Terraform, apply de
dev/prod, configuración de GitHub Environments, operación del cluster y
tear down.

---

## Rutas de la aplicación

Ver la tabla completa (incluye el permiso requerido por cada sección del
admin) en [`STRUCTURE.md`](./STRUCTURE.md#rutas-de-la-aplicación).
