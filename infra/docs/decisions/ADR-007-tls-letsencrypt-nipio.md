# ADR-007 — TLS en prod vía Let's Encrypt + nip.io

**Status:** Accepted · **Date:** 2026-05-28

## Contexto

Producción necesita HTTPS válido (candado verde) pero el proyecto no
tiene un dominio registrado. Alternativas:

1. Comprar un dominio + Route53 hosted zone.
2. `appointment-scheduling.<EIP>.nip.io` (DNS gratuito que resuelve
   cualquier `*.<dashes>.nip.io` al IP en las dashes).
3. Self-signed cert + browser warning.
4. CloudFront + ACM cert.

## Decisión

**Let's Encrypt + nip.io** vía cert-manager dentro del cluster.

## Cómo funciona

- `cert-manager` instalado por el user-data (cluster-wide).
- `ClusterIssuer` `letsencrypt-prod` configurado con ACME HTTP-01.
- El Ingress del overlay `prod` se anota:
  `cert-manager.io/cluster-issuer: letsencrypt-prod`.
- cert-manager pide el cert a Let's Encrypt; el challenge HTTP-01 se
  resuelve porque `appointment-scheduling.<EIP>.nip.io` resuelve
  efectivamente a ese EIP.
- traefik termina TLS con el cert generado.
- Renovación automática ~30 días antes de expirar.

## Por qué no en dev

- Cada cert tarda ~30s en emitirse en el primer apply.
- cert-manager consume ~80-120 MB RAM. En t3.micro de dev es notable.
- Dev queda con self-signed de traefik (degradación graciosa).

## Rate limit de nip.io

nip.io comparte un eTLD+1. Si Let's Encrypt rate-limita (50 certs/week
por eTLD+1 entre todos los usuarios del mundo), cambiar el annotation
a `letsencrypt-staging` durante ~7 días.

## Migration path

Cuando compres un dominio:
1. Crear A record en tu DNS → EIP de prod.
2. Sustituir el host placeholder por tu dominio en el overlay.
3. cert-manager re-emite cert para el dominio real.
