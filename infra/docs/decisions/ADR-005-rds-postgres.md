# ADR-005 — RDS PostgreSQL como BD primaria

**Status:** Accepted · **Date:** 2026-05-28

## Contexto

La app usa Prisma sobre PostgreSQL. Opciones para producción:

1. **Amazon RDS PostgreSQL** (managed).
2. **Aurora PostgreSQL** (managed, más features).
3. **Postgres en el mismo EC2 que el k3s.**
4. **Postgres en un EC2 dedicado.**

## Decisión

**Amazon RDS PostgreSQL `db.t3.micro`, single-AZ, gp2 20 GB.**

## Por qué

- **Free Tier:** RDS db.t3.micro / db.t4g.micro son free durante 12 meses
  (750 hrs/mo). 20 GB de storage gratis. 20 GB de backups gratis.
- **Backups automáticos** sin scripts custom.
- **SSL forzado** vía parameter group (`rds.force_ssl = 1`).
- **Acceso privado:** `publicly_accessible = false`. Solo el SG del
  k3s puede conectarse al puerto 5432.
- **Separation of concerns:** la BD no vive en el mismo EC2 que la app;
  un Spot reclaim del nodo no borra los datos.

## Aurora descartado

Aurora **no** está cubierto por Free Tier — la instancia más barata
(db.t3.medium) cuesta ~$50/mo. Es overkill para Free Tier.

## Postgres en el EC2 descartado

- El Spot reclaim borra el storage local → pérdida total de datos.
- EBS persistente añadiría complejidad operacional (snapshots, mount
  en boot) sin las garantías de RDS.

## Manejo de credenciales

La password master la genera Terraform y se guarda en SSM Parameter
Store (SecureString). El user-data del módulo `ec2-k3s` la lee con
el instance profile y la escribe en el Secret de Kubernetes
`appointment-scheduling-secret` **antes** de aplicar el overlay.

Ningún secreto vive en archivos planos del Terraform state.

## Migración path

- **Multi-AZ** (ADR-004): flip `multi_az = true`. ~$15/mo extra.
- **Aurora Serverless v2** cuando el tráfico justifique pay-per-use.
- **Read replica:** dimensión separada, fácil agregar con el módulo.
