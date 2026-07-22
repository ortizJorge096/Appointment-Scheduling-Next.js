# ADR-014 — Cache de `/_next/image` en el edge (Cloudflare)

**Status:** Accepted · **Date:** 2026-07-21

## Contexto

El optimizador de imágenes de Next (`/_next/image`) **re-optimiza en cada MISS**
(~1 s por imagen del hero, medido). Ya arreglamos el lado del **origen**:

- `minimumCacheTTL: 31536000` en [`next.config.ts`](../../../next.config.ts) → cada
  variante optimizada se cachea 1 año (antes `max-age=60` → re-optimización cada minuto).
- Volumen `emptyDir` montado en `/app/.next/cache` en
  [`deployment.yaml`](../../k8s/base/deployment.yaml) → sin él, `readOnlyRootFilesystem`
  hacía que las escrituras de Next fallaran en silencio y el pod re-optimizara **siempre**.

Pero esa cache de origen es **por-pod** (cada una de las 2–4 réplicas del HPA calienta la
suya) y **volátil** (un `emptyDir` muere en cada deploy/reinicio). Resultado: después de
cada deploy, y entre réplicas, vuelven los MISS fríos.

Cloudflare **ya está delante** de `vjbeautystudio.com` (proxy naranja — inyecta su beacon
de RUM en el edge, ver el cambio de CSP en `next.config.ts`). Una cache en el edge es
**compartida entre todas las réplicas** y **sobrevive los deploys**.

## Decisión

Una **Cache Rule** de Cloudflare sobre `/_next/image*`:

- **Match:** `starts_with(http.request.uri.path, "/_next/image")`.
- **Cache eligibility:** *Eligible for cache* (cache everything).
- **Edge TTL / Browser TTL:** *Respect origin* — el origen ya manda
  `Cache-Control: max-age=31536000`, así que Cloudflare hereda 1 año sin duplicar config.
- La query string (`url`, `w`, `q`) ya entra en la cache key por defecto → cada variante
  se cachea aparte.

Aplicada **a mano en el dashboard** (Cloudflare **no** está en Terraform en este repo) y
documentada acá + en el [runbook](../runbooks/cloudflare-cache-next-image.md). El **Worker
de mantenimiento** en `/*` convive sin problema: su `fetch(request)` de passthrough pasa
por la cache, así que la regla aplica igual al subrequest.

## Alternativas evaluadas y descartadas

1. **CloudFront delante del optimizador** → otra pieza en AWS, otro costo, DNS/cert nuevos.
   Descartada: Cloudflare **ya** está delante, gratis.
2. **Cache Rule + `Accept` en la cache key** (elimina el riesgo `Vary`, ver abajo) →
   requiere **plan Pro+**. Descartada: estamos en free.
3. **Cachear en el Worker** (Cache API + key normalizada a `webp`/`avif`/`orig`) → cero
   riesgo `Vary` y **versionado en el repo**, pero mete lógica en el worker **crítico** de
   mantenimiento por un caso <0.1%. Descartada por ahora; queda como **plan B**.

## Riesgo aceptado: `Vary: Accept`

Next sirve **WebP** a los navegadores que lo aceptan y el **original** (JPEG/PNG) a los que
no, y marca la respuesta con `Vary: Accept`. Cloudflare (fuera de Enterprise) **ignora ese
`Vary`**: cachea **una** variante y se la da a todos. Si el primer MISS produce WebP, un
navegador sin WebP vería la imagen rota.

- **Magnitud:** WebP está soportado en ~99% del parque (Chrome 32+, Firefox 65+,
  Safari 14 / iOS 14+, Edge). El caso roto es **<1%**, solo **imágenes**, no el sitio.
- Next default `formats = ['image/webp']` → **AVIF no está activo**, así que solo hay 2
  variantes (webp / original), lo que acota aún más la superficie.
- **Salida:** si se activa AVIF (3 variantes, más superficie) o si el problema aparece,
  pasar al **plan B** (Worker con key normalizada) o subir a Pro+ y meter `Accept` en la key.

## Consecuencias

- Los repeat-loads del hero se sirven desde el edge (`cf-cache-status: HIT`), **compartido
  entre réplicas** y **sobrevive deploys** — que es justo lo que el `emptyDir` por-pod no da.
- El `emptyDir` de `.next/cache` sigue siendo un **segundo nivel** útil (primer visitante
  tras un purge, o si CF hace MISS).
- **Invalidación:** las keys de S3 son **inmutables** (imagen cambiada = key nueva = URL
  nueva), así que el TTL de 1 año **nunca** sirve una imagen vieja. Si hiciera falta, purge
  por URL/prefijo en el dashboard.
- **No versionado:** es click-ops. Mitigado con este ADR + el runbook. Si algún día entra el
  provider `cloudflare` a Terraform, **codificar la regla ahí** y marcar esto como superado.

## Reversa

Deshabilitar o borrar la Cache Rule en el dashboard → el edge deja de cachear al instante;
el `emptyDir` de origen sigue sirviendo. Sin cambios de código ni deploy.
