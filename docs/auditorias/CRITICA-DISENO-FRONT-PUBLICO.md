## Crítica de diseño: Sitio público (landing + reserva)

> Basada en el código real del frontend (`src/components/public/`, `src/app/page.tsx`, `globals.css`, `tailwind.config.ts`). Al no haber Figma ni capturas conectadas, la evaluación es sobre marcado, tokens, jerarquía y accesibilidad del DOM — no sobre píxeles renderizados. Para el matiz visual fino (sombras, ritmo real, foto), conviene un pase con capturas.

### Impresión general

Es un frontend con identidad clara y madura: paleta oro/beige/tinta, serif elegante (Cormorant) para titulares, DM Sans para cuerpo y un script para el logo — coherente con un estudio de belleza premium. La mayor oportunidad no es estructural sino de **pulido de accesibilidad**: varios textos de bajo contraste y algunos detalles semánticos que hoy quedan a medio camino.

### Usabilidad

| Hallazgo | Severidad | Recomendación |
|----------|-----------|----------------|
| Hero con foco claro (h1 + CTA dorado "Agendar cita") y promesa concreta ("en menos de un minuto") | 🟢 Bien | Mantener; es un buen gancho |
| 7 `<button>` sin `type` explícito | 🟡 Moderado | Dentro de un `<form>`, un botón sin `type` es `submit` por defecto → envíos accidentales. Poner `type="button"` salvo el de envío real |
| Doble CTA en Hero ("Agendar" vs "Ver servicios") con jerarquía correcta (sólido vs outline) | 🟢 Bien | Correcto: una acción primaria, una secundaria |
| Orden móvil invertido (carrusel arriba, texto abajo con `order-last`) | 🟢 Bien | Buena decisión: la imagen engancha antes en móvil |

### Jerarquía visual

- **Qué capta el ojo primero**: el h1 "Realza tu *mejor versión*" con el énfasis en oro itálica sobre fondo tinta — correcto, es el mensaje.
- **Flujo de lectura**: logo → h1 → subcopy → CTAs → prueba social. Es un descenso natural y bien escalonado con las animaciones `fade-up` retardadas.
- **Énfasis**: el CTA dorado destaca sobre el tinta; el outline dorado no compite. Buen control del peso visual.
- **Ritmo de sección**: `py-24` consistente y `max-w-7xl` centrado dan un ritmo vertical estable en toda la landing.

### Consistencia

| Elemento | Estado | Nota |
|----------|--------|------|
| Botones | 🟢 | Centralizados en `.btn-primary/.btn-secondary/.btn-outline-gold` — consistencia garantizada por clases de componente |
| Inputs | 🟢 | `.input-field` con detalle fino: `text-base` en móvil para evitar el auto-zoom de iOS Safari (<16px). Muy buen criterio |
| Color/tipografía | 🟢 | Tokens en `:root` + `tailwind.config` (gold/beige/ink escalados). Sistema de tokens real, no valores sueltos |
| Iconos de beneficios | 🟡 | Se usan glifos unicode (`✦ ✛ ♥ ⏱`) como iconos. Visualmente inconsistentes entre sistemas/fuentes; considera un set SVG uniforme (ya tienes `ServiceIcons.tsx`) |

### Accesibilidad

- **Contraste de color** — principal punto a corregir:
  - `text-white/55` (subcopy del Hero) y `text-white/70` (tagline) sobre tinta `#1A1209`: el blanco al 55% de opacidad baja el contraste a una zona límite/insuficiente para AA en texto normal. Subir a ~70–80% o usar un gris claro sólido.
  - `logo-studio` combina `text-[0.6rem]` (~9.6px) **y** `text-white/70`: tamaño por debajo de lo legible + baja opacidad. Subir tamaño y opacidad.
  - `text-gold` (`#B8932A`) sobre fondos claros (beige/blanco) ronda ~3.5:1 → **falla AA para texto normal**, pasa solo para texto grande. En los `<em>` dentro de h1/h2 va bien (es grande); revisar cualquier "eyebrow"/etiqueta dorada pequeña sobre claro y oscurecer a `gold-dark` (`#8A6E1E`).
- **Base semántica sólida**: 13 `aria-label`, `aria-expanded`, `aria-checked` + `role="radio"/"checkbox"/"dialog"` con `aria-modal`, y `aria-hidden` en decorativos. El `DateTimePicker` como grupo de radios accesible es un acierto. Cero `onClick` en `div`/`span` — no hay controles falsos.
- **Texto alternativo**: solo ~4 `alt=` en todo `public/`, habiendo carrusel Hero, galería e imagen "Nosotros". Verificar que `HeroCarousel` y `Galeria` pongan `alt` descriptivo (o `alt=""` intencional si son puramente decorativas).
- **Glifos icónicos** (`✦ ✛ ♥`): al ir dentro de `<span>` sin `aria-hidden`, un lector de pantalla puede leerlos como caracteres sueltos. Marcarlos `aria-hidden="true"`.
- **Movimiento**: `animate-fade-up` con delays escalonados es agradable, pero no vi guard de `prefers-reduced-motion`. Añadir un `@media (prefers-reduced-motion: reduce)` que desactive las animaciones para usuarios sensibles.

### Lo que funciona bien

- Sistema de diseño real con tokens y clases de componente — la consistencia no depende de disciplina manual.
- Detalles de producto de nivel senior: anti-zoom de iOS en inputs, expansión de tap-target (`.btn-row-action`), ISR en la landing con fallback a defaults si la DB no responde.
- Jerarquía del Hero y ritmo vertical de secciones muy cuidados.
- Buena base ARIA en los controles interactivos personalizados.

### Recomendaciones prioritarias

1. **Subir contraste de los textos claros** — `text-white/55→/75`, `text-white/70→/85`, y agrandar `logo-studio`; cambiar dorado pequeño sobre fondo claro a `gold-dark`. Es el cambio de mayor impacto y afecta legibilidad real, no solo cumplimiento.
2. **`type="button"` en los 7 botones que no lo declaran** — evita envíos de formulario accidentales; corrección rápida y de bajo riesgo.
3. **Completar `alt` en carrusel y galería + `aria-hidden` en glifos decorativos, y añadir `prefers-reduced-motion`** — cierra la mayoría de huecos de accesibilidad que quedan.

---

*Crítica generada con la skill `/design-critique` (plugin Design). Para un pase visual con píxeles reales, comparte capturas o conecta Figma y la reejecuto sobre el render.*
