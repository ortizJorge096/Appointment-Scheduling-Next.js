## Auditoría del sistema de diseño

> Escaneo estático de `src/` (público + admin): `globals.css`, `tailwind.config.ts` y todos los `.tsx`. Métricas extraídas del código real, no estimadas.

### Resumen

**Componentes/clases revisados:** ~31 clases de componente · **Problemas encontrados:** 4 mayores + varios menores · **Puntuación:** 72/100

Hay un sistema de tokens real y bien pensado (paleta oro/beige/tinta escalada, tipografías, animaciones). El problema no es su ausencia, sino la **fuga**: mucho código reintroduce valores que ya existen como token, y la escala tipográfica pequeña está fragmentada en tamaños ad hoc.

### Consistencia de nombres

| Problema | Componentes | Recomendación |
|----------|-------------|----------------|
| Dos "primarios" que compiten | `.btn-primary` y `.btn-cta` | Definir cuál es el CTA canónico; renombrar el otro o fusionarlos. Hoy no está claro cuándo usar cada uno |
| Dos nombres para la misma "etiqueta sobre título" | `.eyebrow-center` y `.section-tag` | Unificar en un solo nombre (p. ej. `.eyebrow`) con modificador de alineación |
| Casing de color inconsistente | `#1A1209` vs `#1a1209` | Da igual visualmente, pero rompe deduplicación y búsquedas. Normalizar a mayúsculas (mejor aún: token) |
| Badges y `input-*` | `.badge-*`, `.input-field/-dark`, `.select-field` | 🟢 Bien nombrados y consistentes — mantener este patrón |

### Cobertura de tokens

| Categoría | Definidos | Valores hardcodeados encontrados |
|-----------|-----------|----------------------------------|
| Colores | Escala completa gold/beige/ink + CSS vars | **149** hex en 10 archivos. La mayoría son **duplicados de tokens existentes**: `#7A7060`=`ink-muted` (36×), `#1A1209`=`ink` (30×), `#E8DCC4`=`beige-dark` (29×), `#B8932A`=`gold` (19×), `#D4AD5A`=`gold-light`, `#8A6E1E`=`gold-dark`, `#2A2014`=`ink-soft` |
| Colores fuera del sistema | — | Algunos hex **no están en la paleta**: `#FAF7EE` (7×), `#b7ae9c` (3×), `#cfc6b4` (2×), `#262017`, `#0F0A05`. Decidir si se promueven a token o se eliminan. `#25D366` (WhatsApp) es marca externa → legítimo, pero conviene aislarlo como `--wa-green` |
| Tipografía | Familias tokenizadas; **sin escala de tamaños** | **102** `text-[Npx]` arbitrarios: 10px (53×), 11px (30×), 15px, 13px, 12px, y **8px/9px** (por debajo del mínimo legible). Micro-escala fragmentada sin token |
| Espaciado | Escala Tailwind (bien) | Pocos arbitrarios (`w-[120px]`, `max-w-[60%]`) — menor |
| Radios | Sin token; 5 valores en uso | `rounded-full` (77×), `xl` (67×), `lg` (48×), `2xl` (20×) forman un set razonable; `rounded-md` (1×) y `rounded-t` (1×) son one-offs a normalizar |

### Completitud de componentes

| Componente | Estados | Variantes | Docs | Score |
|------------|---------|-----------|------|-------|
| Button (`.btn-*`) | default/hover/disabled ✅ · **loading ❌** | ✅ (primary/secondary/outline/ghost/cta) | ❌ | 7/10 |
| Input (`.input-field`) | default/focus/disabled ✅ · **error ❌** | ⚠️ (field/dark/select) | ❌ | 6/10 |
| Badge (`.badge-*`) | estado por variante ✅ | ✅ (pending/confirmed/completed/cancelled/no) | ❌ | 7/10 |
| Card (`.card`, `.card-premium`) | default/hover ✅ | ✅ | ❌ | 7/10 |

No existe ninguna clase de estado `loading`/`spinner`/`error`/`aria-busy` en `globals.css` (0 coincidencias). Los estados de carga y error probablemente se resuelven inline por componente → inconsistencia garantizada a medida que crezca.

### Acciones prioritarias

1. **Reemplazar los 149 hex por tokens** — empezar por los duplicados exactos (`#7A7060`→`ink-muted`, `#1A1209`→`ink`, `#E8DCC4`→`beige-dark`, `#B8932A`→`gold`…). Es mecánico, de bajo riesgo y elimina de golpe la mayor fuente de deriva. Los hex fuera de paleta se deciden caso por caso.
2. **Definir una escala tipográfica y matar los `text-[Npx]`** — mapear 10/11/12/13/15px a tokens (`text-2xs`, `text-xs`, `text-sm`…) en `tailwind.config`, y eliminar `text-[8px]`/`text-[9px]` por ilegibles. Convierte 102 valores sueltos en ~5 tokens.
3. **Añadir estados `loading` y `error` a Button e Input** — una clase reutilizable (spinner + `aria-busy`, y borde/mensaje de error) para no reinventarlos en cada formulario.
4. **Resolver los duplicados de nombre** — un solo primario (`btn-primary` vs `btn-cta`) y un solo nombre de eyebrow; normalizar casing de hex.

Con las acciones 1 y 2 la puntuación sube con facilidad al rango 85–90; son las de mayor impacto por esfuerzo.

---

*Auditoría generada con la skill `/design-system audit` (plugin Design). Puedo continuar con `document <componente>` para documentar Button/Input, o `extend <patrón>` para diseñar los estados que faltan.*
