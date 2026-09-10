# ADR 0022 · La ficha sube la prominencia visual de la calificación

- **Estado:** aceptada
- **Fecha:** 2026-09-10
- **Decide:** responsable del proyecto, a partir de revisión de la Fundación Nodo Social
- **Reemplaza:** ajusta —no reemplaza— la parte visual de la regla de producto 5 de
  `AGENTS.md`. El mecanismo de fondo (solo reseña quien tiene código, un código sirve una
  vez) no cambia.
- **Fuente:** `aquive-cambios.pdf`, revisión de la Fundación, 2026-09-10

## Contexto

La regla de producto 5 fija a propósito una jerarquía visual: «La ficha muestra en grande
cuántos servicios confirmados hay y en pequeño el promedio: una sola reseña mala no puede
hundir a alguien que vive de esto.» Hoy la sección de reseñas de `/prestador/[id]` (título
«Qué dice quien lo contrató») implementa exactamente eso — el número de servicios
confirmados en `text-2xl font-bold`, el promedio como texto secundario más chico.

La Fundación pide dos cosas sobre esa sección: cambiar el título a «Calificación», y que
«permita visualizar la valoración o calificación del vendedor/servicio» — confirmado con
ellos que esto significa subir la prominencia visual del promedio/estrellas, no solo
renombrar el título.

## Decisión

- El título de la sección pasa de «Qué dice quien lo contrató» a **«Calificación»**.
- El promedio (o su representación en estrellas) gana prominencia visual — deja de ser el
  dato secundario y pasa a estar al mismo nivel o por encima del conteo de servicios
  confirmados.
- **El conteo de servicios confirmados no desaparece ni se reduce de tamaño por debajo de lo
  que es hoy.** La protección que busca la regla 5 —que una sola reseña mala no hunda a
  alguien— sigue viva mientras el volumen siga siendo visible con fuerza: lo que cambia es
  que el promedio deja de estar escondido, no que el volumen deje de contar.

## Alternativas consideradas

**No tocar la jerarquía, solo renombrar el título.** Es lo que se hizo en `/ayuda` §"formato
de las preguntas" (donde el PDF solo pedía forma, no jerarquía) — pero aquí la Fundación
confirmó explícitamente que sí quiere más prominencia para el promedio, así que esta
alternativa no responde al pedido real.

**Ocultar el conteo de servicios confirmados y mostrar solo el promedio, como hace la
mayoría de apps de reseñas.** Se descarta: es exactamente lo que la regla 5 fue escrita para
evitar — un prestador nuevo con una reseña de 1 estrella no puede quedar reducido a "1.0 ★"
sin contexto de volumen.

## Qué reglas duras cambian de garante

| Regla | Hoy | Después |
| --- | --- | --- |
| Regla de producto 5 · jerarquía volumen-grande / promedio-chico | el promedio es texto secundario, chico | el promedio sube de prominencia visual, pero el volumen se mantiene visible con el mismo peso que hoy — la protección sigue siendo "nunca solo el promedio", no "el promedio nunca se ve" |

## Consecuencias

### Positivas

- Responde al pedido explícito de la Fundación sin renunciar a la protección de fondo de la
  regla 5.

### Negativas

- Es un rediseño visual de una sección con una intención de producto muy específica —
  cualquier ejecución futura de este bloque tiene que revisarse contra este ADR, no solo
  contra el gusto visual del momento, para no derivar hacia "solo promedio" con el tiempo.

## Plan

1. `AGENTS.md`, regla de producto 5: anotar que la jerarquía admite calificación con más
   prominencia, siempre que el volumen se mantenga visible.
2. Plan de ejecución para Antigravity en `Planes/ficha-calificacion-y-aviso-flotante.md`.
