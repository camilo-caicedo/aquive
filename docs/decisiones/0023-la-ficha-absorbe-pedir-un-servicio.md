# ADR 0023 · La ficha absorbe el flujo de pedir un servicio

- **Estado:** aceptada
- **Fecha:** 2026-09-10
- **Decide:** responsable del proyecto, a partir de revisión de la Fundación Nodo Social
- **Reemplaza:** la fila «Contratar → 10 Pedir → `app/servicios/publicar`» de la tabla de
  `AGENTS.md` §Pantallas, cuando la solicitud parte de una ficha conocida
- **Fuente:** `aquive-cambios.pdf`, revisión de la Fundación, 2026-09-10

## Contexto

El mapa de pantallas de `AGENTS.md` separa la pantalla 09 (Ficha, `app/prestador/[id]`) de
la pantalla 10 (Pedir, `app/servicios/publicar`): la ficha muestra un único botón «Pedir
este servicio» que navega a una pantalla aparte, donde —si el prestador tiene más de un
oficio— se elige cuál con una selección de pastillas de una sola opción.

La Fundación pide que ese selector viva **dentro** de la ficha: un bloque «¿Qué necesitas?»
con la lista de oficios del prestador y un botón «Solicitar servicio» al fondo, sin salir de
`/prestador/[id]`.

## Decisión

`/prestador/[id]` absorbe la selección de oficio y el envío de la solicitud. El botón único
«Pedir este servicio» de `BarraContacto` se retira; en su lugar, la ficha muestra el
selector de oficio inline (mismo mecanismo de una sola opción que hoy tiene
`formulario-publicar-servicio.tsx`, reutilizado como bloque embebido) y el envío ocurre sin
navegar a otra ruta.

`/servicios/publicar` **no desaparece**: sigue existiendo como entrada para quien llega con
un `proveedor` en la query string desde fuera de la ficha (un enlace compartido, por
ejemplo), y como base del componente que la ficha ahora embebe. Lo que cambia es que ya no
es el único camino desde la ficha.

`AGENTS.md` §Pantallas se actualiza: la fila «Contratar → 10 Pedir» pasa a describir
`/servicios/publicar` como ruta de respaldo, y la fila «Buscar → 09 Ficha» anota que incluye
el envío de la solicitud.

## Alternativas consideradas

**Redecorar la ficha sin fusionar el flujo, dejando el botón único a `/servicios/publicar`.**
Es la lectura mínima del PDF, pero el mockup «SUGERENCIA» de la Fundación muestra el
selector y el botón «Solicitar servicio» dentro de la misma pantalla que «Qué hace»/«Qué
vende» — confirmado con ellos que sí quieren la fusión, no solo el rediseño visual de las
tarjetas.

## Qué reglas duras cambian de garante

| Regla | Hoy | Después |
| --- | --- | --- |
| `AGENTS.md` §Pantallas · límite entre pantalla 09 (Ficha) y 10 (Pedir) | dos pantallas, una navegación entre ellas | una pantalla hace las dos cosas; `/servicios/publicar` queda como ruta de respaldo para enlaces externos |
| Regla de interfaz 9 · «Destino o flujo, nunca las dos cosas» | la ficha es un destino (marca arriba, barra abajo); pedir es un flujo (volver y título arriba, sin barra) | la ficha sigue siendo destino — el selector de oficio se resuelve **dentro** del destino, sin que la ficha adopte el patrón de flujo. Si el envío necesita su propia confirmación de flujo, esa parte puede abrirse en una hoja inferior (`HojaAccion`), no cambiando el marco de la página |

## Consecuencias

### Positivas

- Menos fricción para pedir: no hay navegación intermedia cuando el prestador ya tiene solo
  un oficio publicado o cuando el visitante ya decidió con qué se queda.
- El mockup de la Fundación queda implementado tal como lo pidieron.

### Negativas

- La ficha gana responsabilidad (mostrar + vender + recibir la solicitud), lo que la aleja
  del patrón "una sola acción principal por pantalla" (regla de interfaz 2) si no se diseña
  con cuidado — hay que decidir en el plan de ejecución cuál es *la* acción lima de la
  pantalla ahora que hay dos candidatas (contactar por chat vs. solicitar servicio).
- `/servicios/publicar` deja de ser el camino principal, lo que puede generar drift entre
  las dos implementaciones del selector si no se extrae un solo componente compartido —
  el plan de ejecución debe reusar el mismo componente, no duplicar la lógica.

## Plan

1. `AGENTS.md` §Pantallas: reescribir las filas «Buscar → 09 Ficha» y «Contratar → 10
   Pedir».
2. Plan de ejecución para Antigravity en
   `Planes/ficha-listado-rediseno-y-pedir-inline.md`, con instrucción explícita de reusar
   el componente de selección de oficio en vez de duplicarlo.
