# ADR 0027 · Nombre de negocio y horario por hora exacta, sumados sin reemplazar

- **Estado:** aceptada
- **Fecha:** 2026-09-10
- **Decide:** responsable del proyecto, a partir de revisión de la Fundación Nodo Social
- **Reemplaza:** nada de `AGENTS.md` directamente — agrega dato nuevo a `proveedores` y
  reestructura el formulario de alta en 3 pasos
- **Fuente:** `aquive-cambios.pdf`, revisión de la Fundación, 2026-09-10

## Contexto

La Fundación pide reestructurar «Ofrezco mi trabajo» a 3 pasos (hoy son 6, con 11 bloques):

1. Cuéntanos sobre ti — nombre, foto, teléfono.
2. Cuéntanos qué ofreces — nombre del negocio, categoría, oficios, rango de precio,
   descripción.
3. ¿Cómo pueden encontrarte? — zona, horarios, domicilios, medios de pago, WhatsApp.

Dos campos de ese pedido no existen hoy: **nombre del negocio** (hoy `nombre_visible` es un
solo campo compartido por persona y microempresa) y **horario por hora exacta** (hoy
`proveedores.dias` + `proveedores.franjas` son dos arreglos de texto: días de la semana y
franjas amplias «Mañana/Tarde/Noche»).

`franjas` no es solo un dato de la ficha: lo consumen 12 archivos, incluido el filtro de
`/directorio` (buscar "quién atiende esta tarde") y la consulta pública en
`src/server/servicios/consultas.ts`. Reemplazarlo por horas exactas obligaría a rediseñar
también ese filtro, que la Fundación no pidió tocar.

## Decisión

**Se suma, no se reemplaza.** `dias` y `franjas` siguen exactamente como están —el filtro
por franja amplia en `/directorio` no cambia—. Se agregan dos columnas nuevas y opcionales a
`proveedores`: `hora_desde` y `hora_hasta` (tipo `time`, nullable, sin huso — Colombia tiene
un solo huso horario), que muestran el horario preciso en la ficha y en el formulario, como
detalle adicional sobre la franja ya elegida. Si el prestador no las llena, la ficha sigue
mostrando solo la franja, igual que hoy.

Se agrega `nombre_negocio` (`text`, nullable) a `proveedores`, separado de `nombre_visible`.
Solo tiene sentido cuando `tipo = 'microempresa'` — se valida en el contrato, no con un
`CHECK` nuevo que acople dos columnas de más (ya hay una fila `proveedores_tipo_check` que
no se toca).

**El formulario se reagrupa visualmente en 3 pasos**, sin perder ningún bloque de los 11 que
ya existen — los pasos son una agrupación de UI sobre los mismos bloques (`ClaveSeccion`),
más los dos campos nuevos donde corresponde (nombre del negocio en el paso 2, horas exactas
en el paso 3). `figura`, foto, mapa/dirección con su consentimiento propio, matrícula y el
paso final de permiso de publicación **no se eliminan**: el plan de ejecución decide en cuál
de los 3 pasos entra cada uno, sin sacar ninguno del formulario.

## Alternativas consideradas

**Reemplazar `franjas` por horas exactas.** Se descarta por el radio de impacto — 12
archivos, incluido el filtro público — y porque el PDF no pidió tocar la búsqueda por
franja, solo mostrar un horario más preciso en la ficha del prestador.

**Reusar `nombre_visible` para el negocio, con una bandera de "es nombre de negocio".** Se
descarta: pierde el nombre de la persona detrás de la microempresa, que sigue siendo
relevante (ej. para moderación, para quien ya conoce a la persona).

## Qué reglas duras cambian de garante

Ninguna regla dura de `AGENTS.md` cambia de garante — es dato nuevo, opcional, sin tocar
mínimo legal ni las reglas de producto 1 a 10.

## Consecuencias

### Positivas

- Responde al pedido sin tocar el filtro de `/directorio` ni la consulta pública — cambio
  quirúrgico, no una migración de datos existentes.
- `hora_desde`/`hora_hasta` y `nombre_negocio` son opcionales: ningún prestador existente
  queda con datos inválidos.

### Negativas

- Dos formas de expresar "cuándo atiendo" coexisten (franja amplia + hora exacta), que hay
  que mostrar sin que se contradigan en la ficha — se deja como instrucción explícita en el
  plan de ejecución.
- Reagrupar 11 bloques en 3 pasos visuales, sin sacar ninguno, es trabajo de UI real, no
  cosmético — el plan de ejecución lo detalla paso a paso para que Antigravity no tenga que
  decidir dónde entra cada bloque sobre la marcha.

## Plan

1. Migración: `nombre_negocio text` nullable y `hora_desde time`, `hora_hasta time`
   nullables en `proveedores`, con `CHECK proveedores_horario_rango (hora_hasta IS NULL OR
   hora_desde IS NULL OR hora_hasta > hora_desde)`. La ejecuta el arquitecto (Claude Code)
   directamente.
2. Actualizar `src/db/generado/schema.ts`, `src/contrato/servicios.ts`,
   `src/lib/servicios.ts`. También lo ejecuta el arquitecto, en
   `Planes/esquema-nombre-negocio-y-horarios.md`.
3. Plan de ejecución para Antigravity (una vez el contrato esté mergeado) en
   `Planes/formulario-proveedor-3-pasos.md`.
