# ADR-008 — Spot recovery vía ASG

**Status:** Accepted · **Date:** 2026-05-28

## Contexto

EC2 Spot instances son ~70% más baratas que on-demand, pero AWS puede
reclamarlas con 2 minutos de aviso. Sin recuperación automática, un
reclaim deja el cluster permanentemente caído.

## Decisión

**Auto Scaling Group `desired_capacity=1` con Mixed Instances Policy +
`capacity_rebalance = true`.** EIP persistente re-attached por user-data
en cada boot.

## Mecanismo

1. **Capacity Rebalance:** cuando AWS marca la instancia "at risk" de
   reclaim, el ASG lanza una reemplazo proactivamente — antes del
   aviso de 2 minutos.
2. **Mixed Instance Types:** la ASG puede usar cualquiera de los tipos
   en `spot_instance_types` (t3.micro/t3a.micro/t3.small para dev,
   t3.medium/t3a.medium/t3.large para prod). Reduce la probabilidad de
   capacity shortage.
3. **price-capacity-optimized:** AWS prioriza el pool con menor riesgo
   de interrupción, dentro del mismo rango de precio.
4. **EIP persistente:** vive aparte de la instancia. El user-data
   ejecuta `aws ec2 associate-address --allow-reassociation` al
   arrancar — el FQDN nip.io / `nextauth_url` no cambia.
5. **Self-hosted runner cleanup:** el user-data llama a la GH API y
   borra runners "offline" con el prefijo `k3s-runner-` antes de
   registrar el suyo, evitando acumulación.
6. **ECR token timer:** systemd timer cada 8h refresca el token
   (TTL 12h) y k3s hace HUP a containerd.
7. **cert-manager state:** el ClusterIssuer y los Certificate resources
   son recursos de etcd → se pierden con el k3s. cert-manager los
   re-crea en el primer boot. Como el FQDN nip.io es estable, Let's
   Encrypt reusa el cert si aún es válido (no rate limit).

## RPO / RTO

- **Datos de la app:** RPO=0 (vive en RDS, no en el EC2).
- **Datos de assets:** RPO=0 (vive en S3).
- **RTO del cluster:** ~5-7 minutos:
  - 1 min — ASG decide reemplazo
  - 2 min — boot de EC2 + dnf install
  - 2 min — k3s install + cert-manager + apply overlay
  - 1 min — pod ready

## Fallback a on-demand

Si Spot está agotado en TODOS los pools:

```hcl
on_demand_percentage_above_base_capacity = 100
```

en el environment tfvars y re-apply. La ASG cambia a on-demand sin
re-crear el Launch Template.
