# Runbook — Cache de `/_next/image` en Cloudflare

Implementa [ADR-014](../decisions/ADR-014-cloudflare-edge-cache-next-image.md). Cachea las
variantes ya optimizadas del optimizador de Next en el **edge**, para que sean compartidas
entre réplicas y **sobrevivan los deploys** (el `emptyDir` por-pod no da ninguna de las dos).

> Es **config de dashboard** (Cloudflare no está en Terraform). Sin cambios de código ni
> deploy. Reversible al instante (paso 5).

## 0. Pre-flight — confirmar los headers del origen

La regla solo sirve si el origen manda un `Cache-Control` cacheable. Tomá una URL real de
imagen (DevTools → pestaña **Network** → filtrá `_next/image` en la home → clic derecho →
**Copy URL**), guardala en `IMG` y mirá los headers **saltándote la cache de CF** con un
query param bogus:

```bash
IMG='https://vjbeautystudio.com/_next/image?url=...&w=1200&q=75'   # ← pegá la tuya
curl -sI -H 'Accept: image/webp,*/*' "${IMG}&cfbust=$RANDOM" \
  | grep -iE 'cache-control|content-type|vary|cf-cache-status'
```

Esperado:

- `cache-control: public, max-age=31536000, must-revalidate` (el 1 año del `minimumCacheTTL`).
- `content-type: image/webp` (negoció WebP por el `Accept`).
- `vary: Accept` ← **este es el header del gotcha del ADR** (Cloudflare lo va a ignorar).
- `cf-cache-status: DYNAMIC` ← hoy CF **no** cachea esta ruta (no tiene extensión de archivo).

Si el `cache-control` NO trae el `max-age` largo, **frená**: falta el arreglo de origen
(revisá `minimumCacheTTL` en `next.config.ts` y el mount `.next/cache` en `deployment.yaml`)
antes de cachear en el edge.

## 1. Crear la Cache Rule

Dashboard de Cloudflare → dominio **vjbeautystudio.com** → **Caching → Cache Rules** →
**Create rule**.

- **Rule name:** `Cache _next/image`
- **When incoming requests match** — con los campos guiados:
  - Field = **URI Path** · Operator = **starts with** · Value = **`/_next/image`**
  - (o con el editor de expresión: `starts_with(http.request.uri.path, "/_next/image")`)
- **Then:**
  - **Cache eligibility** → **Eligible for cache**
  - **Edge TTL** → **Respect origin TTL** (hereda el `max-age=31536000` del origen)
  - **Browser TTL** → **Respect origin TTL**
- **Deploy**.

> **Orden:** si ya tenés otras Cache Rules, poné ésta **antes** de cualquier regla de
> *Bypass cache* que pudiera atrapar `/_next/*`. Las reglas se evalúan de arriba hacia abajo.

## 2. Verificar MISS → HIT

Pegá dos veces la **misma** URL (sin el `cfbust`, para caer en la cache real):

```bash
for i in 1 2; do
  curl -sI -H 'Accept: image/webp,*/*' "$IMG" | grep -i 'cf-cache-status'
done
```

Esperado: **1ª** `cf-cache-status: MISS` · **2ª** `cf-cache-status: HIT`. (Puede tardar un
par de segundos en propagar la regla; reintentá.) `HIT` = servido desde el edge, sin tocar
el pod.

Confirmá que **no** se cachea de más — una ruta que NO es imagen debe seguir dinámica:

```bash
curl -sI 'https://vjbeautystudio.com/' | grep -i 'cf-cache-status'   # → DYNAMIC (no HIT)
```

## 3. Sanity — el gotcha del `Vary` (aceptado en ADR-014)

Tras calentar la cache, CF sirve **una sola** variante a todos (ignora `Vary: Accept`). Es el
riesgo asumido (<1% de navegadores sin WebP). Para verlo:

```bash
curl -sI -H 'Accept: image/webp,*/*' "$IMG" | grep -i 'content-type'   # image/webp
curl -sI -H 'Accept: */*'            "$IMG" | grep -i 'content-type'   # MISMO tipo (cacheado)
```

El segundo devuelve el tipo **cacheado**, no el negociado — esperado. Si algún día hay que
eliminar esto (se activa AVIF, o aparece un reporte de imagen rota), ver el **plan B** del
ADR (cachear en el Worker con key normalizada) o subir a Pro+ y meter `Accept` en la cache key.

## 4. Purga (si alguna vez hace falta)

No debería: las keys de S3 son inmutables (imagen nueva = URL nueva). Si aun así:
**Caching → Configuration → Purge Cache** → *Custom Purge* → por URL. Evitá el *Purge
Everything* salvo emergencia.

## 5. Rollback

**Caching → Cache Rules** → la regla `Cache _next/image` → **Disable** (o Delete). El edge
deja de cachear al instante; el `emptyDir` de `.next/cache` en los pods sigue sirviendo.
Sin deploy.
