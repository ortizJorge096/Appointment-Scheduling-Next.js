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

### Verde y gris (estado)

| Token | sobre blanco | sobre beige | sobre `gray-100` |
|-------|--------------|-------------|------------------|
| `green-600` | 3.30 ❌ | — | — |
| `green-700` | **5.02** ✅ | — | — |
| `gray-500` | 4.76 ✅ | 4.07 ❌ | 4.36 ❌ |
| `gray-600` | **7.56** ✅ | **6.36** ✅ | **6.82** ✅ |

Mismo patrón que el rojo: el escalón `-600` de Tailwind parece seguro y no lo es
fuera del blanco puro. `gray-300`/`gray-400` se mantienen donde marcan controles
**deshabilitados** — 1.4.3 exime el texto de componentes inactivos.

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

## Diálogos

El contraste no sirve de nada si el diálogo no existe para quien no ve. `Modal`
y `ConfirmDialog` llevan `role` (`dialog` / `alertdialog`), `aria-modal`, nombre
accesible, trampa de Tab, foco inicial dentro y restauración al cerrar.

Dos reglas que salieron de arreglarlos:

- **El foco inicial no va en el botón de cerrar** — la ✕ va primero en el DOM,
  pero abrir un formulario sobre la salida es mal punto de entrada.
- **Un diálogo destructivo abre en *Cancelar*.** `autoFocus` estaba en confirmar
  aun con `danger`, así que "¿Eliminar? Esta acción no se puede deshacer" abría
  a un Enter de ejecutarse.

**No todo panel es un diálogo.** `profesionales`, `servicios`, `testimonios` y
`CategoriesManager` son formularios **en línea**, sin overlay. Ponerles
`role="dialog"` anunciaría un diálogo inexistente y atraparía el foco en algo de
lo que uno debe poder salir tabulando. El admin tiene **dos** modales reales, no
siete: contarlos antes de "unificarlos".

## Contraste no textual (1.4.11)

El texto (1.4.3) cubre un criterio; los controles y sus estados necesitan 3:1
por 1.4.11. Medido sobre el render:

- **Anillos de foco** — `gold-deep` (4.97) sobre claro, `gold` (6.39) sobre
  ink. Pasan.
- **Estados seleccionados** (día del calendario, chips) — se distinguen por
  **relleno + texto**, no solo por el borde, así que el criterio se cumple por
  otros medios aunque el borde de oro ronde 2.9.
- **ToggleSwitch** — el estado *off* (`bg-beige-dark` sobre blanco) medía
  **1.36:1**: un interruptor apagado invisible. Corregido con un borde
  `ink-muted` (4.87) que delinea el track en ambos estados.

**Bordes de input: corregidos a `ink-muted`.** `.input-field` usaba
`border-beige-dark` — **1.36:1 sobre blanco, 1.14:1 sobre beige**. 1.4.11 *exime*
el control identificado por otros medios (label, placeholder, foco), pero la
decisión de producto pesó más que la excepción legal: en un móvil con reflejo, o
en cuanto el campo tiene valor y ya no muestra placeholder, un borde a 1.36 no se
ve — y un formulario cuyos campos no se ven es mal producto, por muy "suave" que
sea. Los inputs viven sobre blanco *y* beige, y solo la zona de `ink-muted`
(4.87 / 4.09) despeja 3:1 en ambas; ningún gris más claro pasa sobre beige.
`input-dark` (login, sobre ink) pasó de `border-white/10` (1.31) a `/35` (3.21)
por la misma razón. **No se inventó un token a medida** para ahorrar unos puntos
de ratio: eso habría sido pulir el matiz en vez de resolver el problema.

## Deuda consciente

- **Texto sobre fotos** (`HeroCarousel`, `NosotrosImage`) no es medible con
  este método: el auditor no lee el píxel bajo la imagen. Requiere juicio
  visual, no ratios.
- **Navegación por teclado** está cubierta donde importa (trampa de foco en
  modales, orden de tabulación del cajón móvil, anillos de foco en botones),
  pero no hubo un barrido exhaustivo página por página.

## Cuándo reconsiderar

- Si cambia el hex de marca del oro: los tres tokens hay que recalcularlos, no
  ajustarlos a ojo.
- Si se adopta un modo oscuro: la tabla asume beige/blanco como superficies
  claras y `ink` como la oscura.
- Si se apunta a **AAA** (7:1): `gold-deep` (5.91) e `ink-muted-deep` (4.78)
  no bastan.
