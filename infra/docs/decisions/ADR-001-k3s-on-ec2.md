# ADR-001 — k3s sobre EC2 (en vez de EKS)

**Status:** Accepted · **Date:** 2026-05-28

## Contexto

`appointment-scheduling` necesita correr en Kubernetes para cumplir
con los requisitos de horizontal scaling, rolling updates y aislamiento
por namespace entre `dev` y `prod`. El target inicial es mantenerse
dentro de AWS Free Tier durante los primeros 12 meses.

Opciones consideradas:

1. **Amazon EKS** — Managed control plane.
2. **k3s sobre EC2** — Single-node certificado por CNCF.
3. **EC2 + docker run** — Sin K8s.

## Decisión

**k3s sobre EC2 t3.micro (dev) / t3.medium (prod).**

## Consecuencias

| Aspecto | EKS | k3s on EC2 (elegido) |
|---|---|---|
| Costo control plane | $73/mes plano (no Free Tier) | $0 (parte del nodo) |
| Costo nodos | t3.medium (~$30/mo) | t3.micro (free) o t3.medium |
| Multi-AZ | nativo | single-node (single-AZ) |
| HA del cluster | sí | no — replacement vía ASG en ~5-7 min |
| Familiaridad para reviewers | alta | media |
| Compatibilidad de manifiestos | 100% | 100% (CNCF certified) |
| Mantenimiento de upgrades | gestionado | manual (k3s install) |

EKS quedaba fuera del presupuesto Free Tier. k3s sigue siendo un cluster
Kubernetes completo (mismos `apiVersion`/`kind`, mismas CRDs disponibles)
así que los manifiestos son portables — si después necesitas migrar a
EKS, solo cambias el target del kubectl. La pérdida de HA del cluster
se mitiga con un ASG `desired_capacity=1` con capacity rebalance que
reemplaza el nodo en ~5-7 minutos (ADR-008).

## Migración futura a EKS

Cuando los costos justifiquen EKS:
1. Crear EKS cluster con Terraform (módulo eks oficial).
2. Apuntar el deploy job a su kubeconfig.
3. Misma `kustomize build infra/k8s/overlays/<env> | kubectl apply -f -`.
4. Decommission del ec2-k3s.

Ninguna línea de código de la app cambia.
