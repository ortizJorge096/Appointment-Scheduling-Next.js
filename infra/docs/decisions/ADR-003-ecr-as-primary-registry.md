# ADR-003 — Amazon ECR como registro primario

**Status:** Accepted · **Date:** 2026-05-28

## Contexto

CI/CD necesita publicar imágenes Docker en algún registro accesible
por el cluster k3s en EC2. Alternativas: Docker Hub, GitHub Container
Registry, Amazon ECR.

## Decisión

**Amazon ECR privado** por environment (`appointment-scheduling-dev-nextjs`,
`appointment-scheduling-prod-nextjs`).

## Razones

1. **Mismo IaC.** Terraform crea ECR + las policies IAM/OIDC que
   GH Actions necesita para hacer push, y el EC2 hace pull con su
   Instance Profile. Cero secrets compartidos.
2. **Performance.** El pull desde EC2 us-east-1 → ECR us-east-1 va
   por backbone AWS, sin egress charges.
3. **Free Tier.** 500 MB privados gratis durante 12 meses. La imagen
   Next.js standalone + Prisma client ronda 300-400 MB → cabe con
   lifecycle policy.
4. **Lifecycle policy.** Expira untagged tras 7 días y mantiene solo
   las últimas N tagged — el repo no crece de forma incontrolada.

## Consecuencias

- ECR no tiene catálogo público. Si en el futuro necesitas que un
  tercero pueda hacer `docker pull` directo, agrega un mirror público.
- El refresh del token de ECR para containerd es responsabilidad de
  un `systemd timer` en el nodo (cada 8h, TTL del token es 12h).
- Cambiar de cuenta AWS implica re-crear el repo y migrar imágenes
  (no es operación frecuente).
