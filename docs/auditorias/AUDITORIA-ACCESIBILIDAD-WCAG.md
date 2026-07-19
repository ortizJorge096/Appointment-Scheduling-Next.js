## Auditoría de accesibilidad: Sitio público + admin
**Estándar:** WCAG 2.1 AA · **Fecha:** 2026-07-16 · **Método:** revisión estática del código con cálculo real de ratios de contraste (no estimados)

> **Nota de seguimiento (2026-07-16).** Los **3 hallazgos de este documento ya
> están resueltos** — fueron el primer bloque de trabajo tras la auditoría
> (PR #78 → `develop`, commit `335a22c`). Se conserva por su valor histórico:
> describe el estado **previo** al fix.
>
> - **#2 (Mayor) — labels ↔ inputs:** hecho. `BookingForm` asocia cada campo con
>   `htmlFor`/`id` + `aria-invalid`/`aria-describedby`; `DateTimePicker` usa
>   `role="radiogroup"` + `aria-labelledby` en los grupos Fecha/Hora.
> - **#3 (Menor) — landmarks:** hecho. `Navbar` se envuelve en `<header>` y marca
>   los `<nav>` con `aria-label="Navegación principal"`.
> - **#1 (Menor) — dorado grande:** verificado **no reproduce**. Los `<em>` sobre
>   fondo claro ya usan `gold-dark` (4.08 sobre beige → pasa texto grande 3:1); el
>   `text-gold` brillante solo vive sobre superficies oscuras (6.39:1). Sin cambio.

### Resumen

**Problemas encontrados:** 3 · **Críticos:** 0 · **Mayores:** 1 · **Menores:** 2

El proyecto está en buen estado. El código muestra un trabajo de accesibilidad deliberado —tokens de color deepened para contraste, `prefers-reduced-motion` universal, targets de 44px, focus visible, roles ARIA en controles custom— con ratios documentados en comentarios del CSS. El único hallazgo con impacto real es la asociación de etiquetas en el formulario de reserva público.

### Hallazgos

#### Perceivable
| # | Issue | Criterio | Severidad | Recomendación |
|---|-------|----------|-----------|----------------|
| 1 | Énfasis decorativo `text-gold` (`#B8932A`) en titulares sobre fondo claro: 2.90:1 (blanco) / 2.44:1 (beige) | 1.4.3 Contraste (texto grande, 3:1) | 🟢 Menor | Es texto grande decorativo (la palabra dorada dentro de un h1/h2 cuyo resto es tinta oscura; la info no depende del color). Si se quiere cumplimiento estricto, usar `gold-deep` también en el `<em>`; si no, dejarlo como excepción de marca consciente |

Todo lo demás de contraste **pasa** (verificado):

### Comprobación de contraste
| Elemento | Fg | Bg | Ratio | Requerido | ¿Pasa? |
|----------|----|----|-------|-----------|--------|
| Eyebrows/tags (`.section-tag`, `.eyebrow-center`) | gold-deep `#7A611A` | beige | 4.97:1 | 4.5:1 | ✅ |
| " | gold-deep `#7A611A` | blanco | 5.91:1 | 4.5:1 | ✅ |
| Labels de formulario (`.form-label`) | ink-muted-deep `#6E6656` | beige | 4.78:1 | 4.5:1 | ✅ |
| Subcopy Hero (`text-white/55`) | blanco 55% | ink `#1A1209` | 6.15:1 | 4.5:1 | ✅ |
| Tagline Hero (`text-white/70`) | blanco 70% | ink | 9.35:1 | 4.5:1 | ✅ (AAA) |
| Énfasis gold sobre fondo oscuro | gold `#B8932A` | ink | 6.39:1 | 4.5:1 | ✅ |

#### Operable
| # | Issue | Criterio | Severidad | Estado |
|---|-------|----------|-----------|--------|
| — | Focus visible (`focus-visible:ring-gold-deep` + `ring-offset`) | 2.4.7 | — | ✅ presente |
| — | Touch targets (`min-h-[44px]`/`min-w-[44px]`/`h-11`, y `.btn-row-action` que expande el área sin mover el layout) | 2.5.5 | — | ✅ presente |
| — | Controles custom con teclado (radios/checkbox con `role` + `aria-checked`) | 2.1.1 | — | ✅ presente |

#### Understandable
| # | Issue | Criterio | Severidad | Recomendación |
|---|-------|----------|-----------|----------------|
| 2 | En `BookingForm` y `DateTimePicker`, las etiquetas visibles (`.form-label`) son hermanas del `<input>` **sin** `htmlFor`/`id` ni `aria-label` (4 inputs públicos: 0 con `id`, 0 con `aria-label`). El nombre accesible cae al `placeholder`, que no es válido como etiqueta y desaparece al escribir | 3.3.2 Etiquetas · 1.3.1 · 4.1.2 | 🟡 Mayor | Asociar cada label con su input: `htmlFor`/`id` o envolver el `<input>` dentro del `<label>`. Es el flujo más importante del sitio (reserva pública) |
| — | Identificación de errores (`v.errorOf(...)` muestra mensaje inline por campo) | 3.3.1 | — | ✅ presente; añadir `aria-invalid` + `aria-describebby` al mensaje reforzaría el anuncio en lector de pantalla |

#### Robust
| # | Issue | Criterio | Severidad | Recomendación |
|---|-------|----------|-----------|----------------|
| 3 | Landmarks: hay `<main>`, `<nav>`, `<footer>`; no hay `<header>` ni `aria-label` en los `<nav>` (si hubiera más de uno por página) | 4.1.2 / 1.3.1 | 🟢 Menor | Envolver la cabecera en `<header>` y, si conviven varios `<nav>`, distinguirlos con `aria-label` |

### Imágenes (1.1.1)
Las 9 imágenes del proyecto (`Image`/`img` en Hero, Galería, Testimonios, Nosotros, admin) **tienen `alt`** — 100% de cobertura. Verificar solo que el `alt` sea descriptivo del contenido y no genérico.

### Correcciones prioritarias
1. **Asociar labels ↔ inputs en `BookingForm` y `DateTimePicker`** (`htmlFor`/`id` o label envolvente). Único fix con impacto real para usuarios de lector de pantalla, y en el flujo de mayor valor. Añadir de paso `aria-invalid`/`aria-describedby` en los campos con error.
2. **Decidir el énfasis dorado grande** — dejar como excepción de marca o pasar a `gold-deep`. Es cosmético/estricto, no bloqueante.
3. **`<header>` + `aria-label` en nav** — pulido de landmarks.

---
*Auditoría con `/accessibility-review` (plugin Design). Ratios calculados sobre los tokens reales. Un pase manual con VoiceOver/NVDA y teclado confirmaría el hallazgo #2 en vivo.*
