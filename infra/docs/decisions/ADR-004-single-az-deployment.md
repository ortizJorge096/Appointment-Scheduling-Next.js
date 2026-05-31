# ADR-004 — Single-AZ deployment

**Status:** Accepted · **Date:** 2026-05-28

## Contexto

`appointment-scheduling` vive en una sola AZ (la primera subred pública
del VPC). El RDS está también en single-AZ. El EIP queda fijo a esa AZ.

## Decisión

**Single-AZ por ahora**, multi-AZ es upgrade path.

## Por qué

- **Costo:** Multi-AZ RDS duplica el precio de la instancia. Multi-AZ
  con un solo nodo k3s no aporta nada — al primer fallo de AZ ese nodo
  desaparece, no hay réplica en otra zona que tome el tráfico.
- **HA real requiere:** RDS Multi-AZ + cluster K8s multi-nodo en varias
  AZs + Load Balancer ALB/NLB delante. Todo eso es out-of-scope para
  Free Tier.
- **Free Tier no cubre Multi-AZ** en RDS.

## Mitigaciones que SÍ implementamos

| Riesgo | Mitigación actual |
|---|---|
| Spot reclaim del EC2 | ASG capacity_rebalance — instancia nueva en ~5-7 min (ADR-008) |
| Pérdida del IP público | EIP persistente, re-attached por user-data |
| Fallo del proceso k3s | systemd lo reinicia |
| Fallo de la BD | snapshots automáticos + final snapshot configurable |
| Disk full | CloudWatch alarm `disk-high` |
| Memoria llena | CloudWatch alarm `memory-high` |

## Migración a Multi-AZ

1. Subnets DB ya están provisionadas en 2 AZs → solo cambiar
   `multi_az = true` en el módulo `rds-postgres`.
2. K8s multi-nodo: cambiar el módulo `ec2-k3s` a un ASG `min=2/max=N`
   y añadir un Load Balancer delante (alb-controller).
3. Costo estimado tras el cambio: +$30-50/mo.
