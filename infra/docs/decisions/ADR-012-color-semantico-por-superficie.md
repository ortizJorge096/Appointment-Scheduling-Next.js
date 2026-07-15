# ADR-012 — Color semántico por superficie (contraste WCAG AA)

**Status:** Accepted · **Date:** 2026-07-15

## Contexto

La paleta (oro / beige / tinta) se eligió por identidad de marca, no por
contraste. El mismo token se usaba sobre fondos claros y oscuros, así que su
legibilidad dependía de dónde cayera el componente. El resultado: **29 fallos
de contraste AA en la landing y 20 en `/agendar`**, incluido el CTA principal.

Dos métodos no los detectaron:

1. **Grep sobre clases.** No ve las clases de componente de `globals.css`
   (`.btn-primary`, `.section-tag`), ni los estados que solo existen tras
   interactuar (día seleccionado, paso completado del stepper), ni los banners
   de error que requieren provocar una validación.
2. **Una crítica de diseño estática** (`/design-critique`). Acertó el rumbo
   —el contraste era el problema— pero falló los datos: dio por sospechoso
   `text-white/55` (mide 6.15:1, pasa), reportó ausente un guard de
   `prefers-reduced-motion` que ya existía, estimó el oro sobre claro en
   ~3.5:1 (mide 2.44) y recomendó `gold-dark`, que **sigue fallando** a 4.08.

Lo que sí funcionó: un **auditor de contraste sobre `getComputedStyle`**
ejecutado en el navegador y recorriendo el flujo de reserva real. Todos los
números de este ADR salen de ahí, no de estimaciones.

## Decisión

**El color es semántico por superficie y por tamaño de texto, no por estética.**
Cada familia tiene una variante por contexto, y el nombre dice dónde va — no
cómo se ve.

## Por qué

- **El fallo se repetía por token, no por componente.** Arreglar instancias
  sueltas dejaba la puerta abierta; el arreglo pertenece al token.
- **Un token por superficie hace el fallo imposible de reintroducir.** Si el
  nombre indica el fondo, elegir mal es evidente en el `className`.
- **`text-ink` sobre oro ya era el patrón** en `login`, `Sidebar` y
  `testimonios`. Los `text-white` sobre oro eran la inconsistencia, no al revés.

## Tablas de referencia (ratios medidos)

AA exige **4.5:1** en texto normal, **3:1** en texto grande (≥24px, o ≥18.66px
en negrita) y **3:1** en bordes de controles.

### Oro

| Token | Hex | sobre ink | sobre beige | sobre blanco | Usar en |
|-------|-----|-----------|-------------|--------------|---------|
| `gold` | `#B8932A` | **6.39** ✅ | 2.44 ❌ | 2.90 ❌ | Superficies oscuras, o decorativo con `aria-hidden` |
| `gold-dark` | `#8A6E1E` | — | 4.08 ⚠️ | 4.85 ✅ | Solo texto **grande** sobre claro (`<em>` de un h2) |
| `gold-deep` | `#7A611A` | 3.13 ❌ | **4.97** ✅ | **5.91** ✅ | Texto **pequeño** y enlaces sobre claro |

`gold-dark` sobre beige pasa AA *large* (4.08 > 3) pero **falla en texto
normal**. `gold-deep` es al revés: no sirve sobre oscuro.

### Tinta

| Token | Hex | sobre beige | sobre blanco |
|-------|-----|-------------|--------------|
| `ink-muted` | `#7A7060` | 4.09 ❌ | 4.85 ✅ |
| `ink-muted-deep` | `#6E6656` | **4.78** ✅ | **5.68** ✅ |

`ink-muted` es seguro sobre blanco (tarjetas) pero no sobre beige (secciones).

### Rojo (errores)

| Token | sobre blanco | sobre `red-50` | sobre beige | sobre ink |
|-------|--------------|----------------|-------------|-----------|
| `red-400` | 2.77 ❌ | — | — | **6.69** ✅ |
| `red-500` | 3.76 ❌ | 3.44 ❌ | 3.16 ❌ | — |
| `red-600` | 4.83 ✅ | 4.42 ❌ | 4.06 ❌ | — |
| `red-700` | **6.47** ✅ | **5.91** ✅ | **5.44** ✅ | — |

`red-700` es el único que pasa en las tres superficies claras. `red-600`
fallaba justo donde más importa: los banners `bg-red-50`. `red-400` solo se
mantiene en el banner del login, que va sobre tinta.

### Blanco con opacidad, sobre ink

| Clase | Ratio | |
|-------|-------|---|
| `text-white/20` | 1.84 | ❌ |
| `text-white/40` | 3.83 | ❌ |
| `text-white/50` | ~5.3 | ✅ |
| `text-white/55` | 6.15 | ✅ |
| `text-white/70` | ~9.4 | ✅ |

## Reglas

1. **Nunca texto blanco sobre oro** (2.90). Va `text-ink` (6.39). En hover, el
   relleno oro sube a `gold-light` (8.75), no baja a `gold-dark` (que
   devolvería la tinta a 3.8).
2. **Botón outline dorado: dos variantes.** `.btn-outline-gold` para oscuro
   (Hero) y `.btn-outline-gold-on-light` para claro. Una sola clase no puede
   servir a ambas superficies.
3. **Glifos decorativos** (`✦ ✛ ♥ ⏱`) llevan `aria-hidden="true"` y quedan
   exentos.

## No colapsar los tokens

`gold` / `gold-dark` / `gold-deep` e `ink-muted` / `ink-muted-deep` **parecen
redundantes y no lo son**: cada uno es el único que pasa AA en su superficie.
Fusionarlos reintroduce los fallos. Las tablas de arriba son la justificación.

## Cómo re-auditar

Un grep no sirve. Sobre el render (`npm run build && npm start`), recorrer
cada elemento hoja con texto, resolver su fondo real subiendo por el DOM,
componer el alfa del color y comparar contra el umbral según tamaño y peso.
Hay que **recorrer el flujo de reserva**: el día y la hora seleccionados, el
paso completado del stepper y los banners de error no existen en el DOM
inicial y fue justo ahí donde vivían los peores fallos (2.9).

## Deuda consciente

- **Bordes de controles** (`border-red-200`, `border-red-300`) no se
  auditaron contra el 3:1 de WCAG 1.4.11.
- **Texto sobre fotos** (`HeroCarousel`, `NosotrosImage`) no es medible con
  este método: el auditor no lee el píxel bajo la imagen.
- **Foco y navegación por teclado** siguen sin auditar.
- El toggle del menú (`Navbar`) no declara `type="button"`. No hay riesgo de
  envío accidental —está fuera de cualquier `<form>`— pero conviene por higiene.

## Cuándo reconsiderar

- Si cambia el hex de marca del oro: los tres tokens hay que recalcularlos, no
  ajustarlos a ojo.
- Si se adopta un modo oscuro: la tabla asume beige/blanco como superficies
  claras y `ink` como la oscura.
- Si se apunta a **AAA** (7:1): `gold-deep` (5.91) e `ink-muted-deep` (4.78)
  no bastan.
