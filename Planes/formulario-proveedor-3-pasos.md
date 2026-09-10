# TASK_PLAN: Formulario "Ofrezco mi trabajo" — 3 pasos, nombre de negocio y horario exacto

**Estado:** LISTO PARA EJECUCIÓN — depende de `Planes/Terminados/esquema-precio-presentacion-negocio-horario.md`
**Arquitecto:** Claude Code
**Constructor:** Antigravity

## Trazabilidad

- **ADR:** `docs/decisiones/0027-nombre-de-negocio-y-horarios-por-hora.md`
- **Precondición:** `nombre_negocio`, `hora_desde`, `hora_hasta` ya existen en el esquema,
  el contrato y `guardar_proveedor`/`mi_proveedor` — ver el plan terminado en
  `Planes/Terminados/`. Este plan **no** toca base de datos.

`formulario-proveedor.tsx` lo comparten el alta (`/servicios/soy-proveedor`) y
`/perfil/datos` — un solo cambio aquí se propaga a los dos sitios por construcción (ver el
comentario del propio archivo, líneas ~19-30). No hay que tocar `/perfil/datos` aparte.

## 1. Análisis de impacto en el sistema

- **Módulo de dominio:** ninguno nuevo.
- **Archivos a modificar:**
  - `src/app/servicios/soy-proveedor/formulario-proveedor.tsx` — reagrupación de pasos,
    campo nuevo "Nombre del negocio", editor de horario exacto, contador de descripción a
    200.
  - `src/app/servicios/soy-proveedor/page.tsx` — si el nombre de los pasos se muestra ahí.
- **Archivos nuevos:** ninguno necesariamente — evalúa si el editor de horas necesita su
  propio componente chico (ej. `src/components/selector-horario.tsx`) si se vuelve muy
  grande para vivir inline.
- **Dependencias nuevas:** ninguna — usa lo que ya hay (inputs nativos `type="time"` de
  HTML son razonables aquí, no traigas una librería de selector de hora).

## 2. Blueprint arquitectónico y contratos

**Los 11 bloques (`ClaveSeccion`) no se eliminan.** Se reagrupan en 3 pasos visuales:

- **Paso 1 — "Cuéntanos sobre ti":** `quien` (nombre), `foto`, y el teléfono de `contacto`
  (separa el teléfono de los medios de pago dentro de ese bloque si es necesario, o muévelo
  completo aquí y deja medios de pago en el paso 3 — decide con criterio de UI, el punto es
  que nombre+foto+teléfono queden juntos al frente).
- **Paso 2 — "Cuéntanos qué ofreces":** `figura`, el campo nuevo **"Nombre del negocio"**
  (solo relevante si `figura = 'microempresa'` — muéstralo condicionalmente), `categorias` +
  `oficios` (el selector de 3 pasos existente), precio con **"desde $ hasta $"** (el campo
  `precio_hasta` ya existe en el contrato — agrégalo al lado de `precio_desde` en el editor
  de cada oficio, líneas ~1338-1353 y ~1426-1441), y `presentacion` (descripción).
- **Paso 3 — "¿Cómo pueden encontrarte?":** `ciudad`, `zonas` (con `modalidad`,
  mapa/dirección y sus consentimientos propios), `disponibilidad` (días + franjas, sin
  cambios), el editor de horario exacto nuevo (`hora_desde`/`hora_hasta`, opcional, se
  muestra como detalle adicional junto a la franja — dos inputs `type="time"`, o un
  selector simple, validando que hasta sea mayor que desde en el cliente además del `CHECK`
  del servidor), medios de pago, y el teléfono si decidiste dejarlo aquí en vez del paso 1.
- **`matricula` y `permiso`** (el paso final de consentimiento de publicación) se quedan
  donde tengan más sentido — probablemente el permiso de publicación cierra el paso 3, y
  matrícula puede vivir dentro del paso 2 o 3 según cómo quede mejor. No los elimines.

**Descripción a 200:** el `maxLength={300}` del `Textarea` (línea ~1503) y el contador
`{descripcion.length}/300` (línea ~1509) bajan a 200 — el `CHECK` del servidor y el mensaje
de la RPC ya están en 200, esto era lo único que faltaba del lado del cliente.

**Nombre del negocio:** campo de texto, mismo tope que `nombre_visible` (3-60), mismo filtro
de PII que ya aplican los demás campos libres del formulario — usa el patrón que ya sigue
`quien`/`nombre_visible`.

**Horario exacto:** dos campos opcionales. Si se llenan los dos, valida en el cliente que
`hora_hasta > hora_desde` (el servidor ya lo rechaza si no, pero un error en línea es mejor
que esperar el rechazo del envío — regla de interfaz 11).

## 3. Pasos de implementación (Antigravity)

- [ ] **Paso 1 [Reagrupar pasos]:** cambia el array `PASOS` (líneas ~1844-1851) a 3 entradas,
      reasignando las `claves` de cada bloque existente.
- [ ] **Paso 2 [Nombre del negocio]:** agrega el campo al bloque `figura`/`quien`, visible
      solo para `microempresa`, mandándolo a `guardar_proveedor` como `p_nombre_negocio`.
- [ ] **Paso 3 [Precio hasta]:** agrega el input "hasta $" junto a cada "desde $" del
      selector de oficios, mandándolo dentro de `p_oficios` como `precio_hasta`.
- [ ] **Paso 4 [Horario exacto]:** agrega los dos campos de hora en el bloque
      `disponibilidad`, mandándolos como `p_hora_desde`/`p_hora_hasta`.
- [ ] **Paso 5 [Tope 200]:** baja `maxLength` y el contador de la presentación a 200.
- [ ] **Paso 6:** confirma que `/perfil/datos` (que reusa este mismo componente con
      `secciones={['quien', 'figura', 'contacto', 'ciudad', 'presentacion']}`) se sigue
      viendo bien con la nueva agrupación de pasos — si esa pantalla no usa el array
      `PASOS` de la misma forma, revisa que no se rompa.

## 4. Criterios de aceptación

- El formulario de alta muestra 3 pasos, sin perder ningún campo de los 11 bloques
  originales.
- "Nombre del negocio" solo aparece para microempresa, y se guarda.
- Cada oficio admite un "hasta $" opcional junto al "desde $", y se guarda.
- El horario exacto es opcional, no reemplaza la franja amplia, y valida
  `hasta > desde` en el cliente.
- La presentación tiene tope de 200 caracteres, con su contador actualizado.
- `/perfil/datos` sigue funcionando.

## 5. Verificación y puerta de calidad

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] Completar el alta entera de punta a punta, con y sin nombre de negocio, con y sin
      horario exacto, con y sin techo de precio.
- [ ] Probar `/perfil/datos` después del cambio.
- [ ] Sin warnings de build.
- [ ] Aprobación del `git diff` por Claude Code.

## 6. Notas y bloqueos

- **Lint preexistente en este archivo, no tuyo:** `formulario-proveedor.tsx:258` ya falla
  `react-hooks/set-state-in-effect` antes de que toques nada (confirmado contra el último
  commit limpio). No es requisito de este plan arreglarlo, pero si tu edición pasa cerca de
  esa línea, corregirlo de paso es bienvenido — repórtalo en el resumen si lo dejas o si lo
  arreglas.
- Si algún bloque no encaja bien en los 3 pasos propuestos (ej. `matricula` se siente fuera
  de lugar en el paso 2 y en el 3), repórtalo aquí con tu propuesta antes de decidirlo sobre
  la marcha — la agrupación exacta de bloques dentro de cada paso es la única parte de este
  plan que deja margen de criterio.
