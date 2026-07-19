# ADR-013 — BD de PROD en cuenta separada (free-tier) con acceso público acotado

**Status:** Accepted · **Date:** 2026-07-19

## Contexto

La BD de **producción** se mueve a una cuenta AWS **free-tier** separada para
**resetear los 12 meses de Free Tier / bajar costo**. El clúster k3s se queda en la
cuenta principal, así que pasa a conectarse a la BD de prod **entre cuentas** — por
Internet, no dentro de la VPC.

Prod **contiene PII real de clientas + datos de pago** (el propio módulo lo marca en
`environments/prod/main.tf:146`). Hoy está **deliberadamente protegido**:
`publicly_accessible=false`, `deletion_protection=true`, PITR de 1 día.

## Alternativas más seguras — evaluadas y **descartadas**

Se plantearon y se rechazaron a conciencia (motivo: menor esfuerzo de migración):

1. **Mover todo el stack** (cluster + BD) a la cuenta nueva con la BD **privada** →
   mismo ahorro de Free Tier, **cero exposición pública** de PII. Descartada por el
   trabajo extra (DNS, cert, EIP nuevos).
2. **BD cross-account privada por VPC peering** → sin endpoint público. Descartada por
   la complejidad/costo de peering.

## Decisión

**Endpoint de Postgres público, acotado, para prod** — asumiendo el riesgo con
mitigaciones máximas:

1. BD nueva provista por Terraform **standalone** (state/creds de la cuenta free-tier)
   que reusa el módulo `rds-postgres`.
2. `publicly_accessible=true` pero SG restringido a **/32**: IP del operador + **EIP
   del clúster**. `rds.force_ssl` + `sslmode=require` **obligatorio**.
3. **Prod-grade en la BD nueva:** `deletion_protection=true`, `skip_final_snapshot=false`,
   backups PITR **7 días** (Free Tier cubre 20 GB), password de 32 chars generada por TF.
4. Datos migrados con **`pg_dump`/`pg_restore`** desde el box k3s de prod (in-VPC — la
   fuente **no** se expone), en **ventana de mantenimiento** con escrituras frenadas.
5. RDS de prod viejo destruido con **snapshot final**, tras verificar la nueva y **flipear
   `deletion_protection=false`** primero.

## Riesgos aceptados / mitigaciones

- **PII de prod expuesta a Internet.** Mitigado: SG /32 (no rangos), SSL forzado, password
  fuerte, **rotación post-migración**, y monitoreo. Aun así es un downgrade respecto al
  aislamiento en VPC — aceptado a conciencia por costo.
- **Cuenta free-tier personal para PRODUCCIÓN**: dueño único, expira a los 12 meses, riesgo
  de suspensión/cierre = **caída de prod o pérdida de datos**. Mitigado parcialmente por
  backups PITR + snapshot final del viejo + el `.sql`. **Plan de salida:** volver a una
  cuenta gestionada antes del vencimiento del Free Tier.
- **Habeas Data (Ley 1581, CO)**: exponer datos personales conlleva obligaciones. No es
  asesoría legal — queda anotado como consideración a revisar por el responsable.
- **Downtime** durante el corte: ventana de bajo tráfico + freno de escrituras para no
  perder reservas.

## Guardrails de costo (budgets)

Alertas de facturación en **ambas** cuentas. Son **alertas, no topes duros** — AWS Budgets
avisa por email, no corta el gasto ni apaga recursos; y no es en tiempo real (actualiza unas
pocas veces al día).

- **Cuenta free-tier** (la BD nueva): budget **US$5/mes**, gestionado por **Terraform**
  (`environments/prod-db-freetier/budget.tf`, var `budget_alert_email`). Avisa a $1 / $4 / $5.
  El nuevo Free Tier puede cobrar pasado su cap → alerta temprano a $1.
- **Cuenta principal** (prod): budget **US$15/mes**, **codificado en Terraform**
  (`environments/prod/budget.tf`, var `budget_alert_email`). Umbrales de prod — 80% / 100%
  actual / 100% forecast — no el 20% del freetier (en una cuenta con gasto real es ruido).
  Se creó primero a mano en la consola: adoptarlo con `terraform import`, o borrar el manual
  y dejar que TF lo cree.

## Secuencia segura (el orden importa)

1. **Ventana de mantenimiento** + frenar escrituras (scale-down o modo lectura).
2. **Snapshot manual** del RDS de prod (además del PITR).
3. **`pg_dump`** desde el box k3s de prod → `.sql`.
4. **Crear la BD nueva** (TF standalone, prod-grade, cuenta free-tier).
5. **`pg_restore`** + **verificar** (conteos, login admin, una reserva de prueba).
6. **Repuntar `DATABASE_URL`** (SSM cuenta principal) → endpoint nuevo; redeploy; smoke test.
7. **Rotar** la password de la BD nueva.
8. **Recién entonces:** `deletion_protection=false` → destruir el RDS viejo con snapshot final.

## Reversa

Restaurar del snapshot final (o del premigración/PITR), re-apuntar `DATABASE_URL`,
`enable_local_rds=true` para recrear el módulo local en la cuenta principal.
