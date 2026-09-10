# TASK_PLAN: Ficha y listado — rediseño de tarjetas, precio en rango, y pedir sin salir de la ficha

**Estado:** LISTO PARA EJECUCIÓN — depende de `Planes/Terminados/esquema-precio-presentacion-negocio-horario.md`
**Arquitecto:** Claude Code
**Constructor:** Antigravity

## Trazabilidad

- **ADR:** `docs/decisiones/0023-la-ficha-absorbe-pedir-un-servicio.md`,
  `docs/decisiones/0026-el-precio-admite-un-techo.md`
- **Pantalla del prototipo:** 07 Listado, 09 Ficha, 10 Pedir (`AGENTS.md` §Pantallas, ya
  actualizado con la fusión)
- **Precondición:** el esquema y contrato de `precio_hasta` ya están mergeados (columna,
  vistas, `guardar_proveedor`, tipos, `consultas.ts`) — ver el plan ya terminado en
  `Planes/Terminados/`. Este plan **no** toca base de datos.

Es el plan más grande del paquete de la Fundación — dos partes que se pueden auditar por
separado si conviene dividir el trabajo, pero viven en el mismo archivo porque comparten el
componente de selección de oficio.

## 1. Análisis de impacto en el sistema

- **Módulo de dominio:** ninguno nuevo — el contrato y la consulta ya devuelven
  `precio_hasta`.
- **Archivos a modificar:**
  - `src/components/tarjeta-proveedor.tsx` — tarjeta del listado.
  - `src/app/prestador/[id]/page.tsx` — "Qué hace" / "Qué vende", y la fusión con pedir.
  - `src/components/barra-contacto.tsx` — el botón "Pedir este servicio" se retira de aquí.
  - `src/app/servicios/publicar/formulario-publicar-servicio.tsx` — el selector de oficio
    de una sola opción, que se **extrae** para reusarlo embebido en la ficha (ver Sección 2).
- **Archivos nuevos:** probablemente un componente compartido para el selector de oficio +
  envío (ej. `src/components/selector-y-pedido-de-oficio.tsx`), usado tanto en la ficha como
  en `/servicios/publicar` — **no dupliques la lógica de envío en dos sitios**.
- **Dependencias nuevas:** ninguna.

## 2. Blueprint arquitectónico y contratos

### Parte A — Tarjeta de listado y "Qué hace"/"Qué vende" (visual)

- **Tarjeta de listado** (`tarjeta-proveedor.tsx`): cambia el botón "Ver ficha" por **"Ver
  perfil"**. Los oficios apilados siguen mostrando precio, ahora en rango cuando
  `precio_hasta` existe (`precioLegible(modo, precio_desde, unidad, precio_hasta)` — la
  firma ya admite el cuarto argumento opcional, no rompe donde no se pase). **La foto sigue
  opcional, sin placeholder** — no cambies ese comportamiento, ya es intencional (ver
  comentario del archivo).
- **Ficha, "Qué hace"** (`prestador/[id]/page.tsx`, líneas ~119-132): reorganiza la
  presentación siguiendo el mockup del PDF (nombre, precio en rango si aplica), sin perder
  ningún oficio de la lista.
- **Ficha, "Qué vende"** (líneas ~145-182): sin cambios de fondo, solo el ajuste visual que
  el mockup pida si toca esta sección — el PDF se enfoca en "Qué hace", revisa si "Qué
  vende" también necesita el mismo tratamiento antes de tocarla.

### Parte B — Pedir sin salir de la ficha (ADR 0023)

- Extrae el selector de oficio de una sola opción de
  `formulario-publicar-servicio.tsx` (líneas ~90-115) a un componente compartido, junto con
  el envío (`rpc.servicios.publicarSolicitud`).
- Embebe ese componente en `prestador/[id]/page.tsx`, bajo un encabezado **"¿Qué
  necesitas?"**, con el botón final **"Solicitar servicio"**.
- Retira el botón único "Pedir este servicio" de `barra-contacto.tsx` — la barra de contacto
  se queda con lo demás que ya tenía (WhatsApp/llamar si publicó teléfono, chat).
  **Decide y documenta en tu resumen final** cuál es ahora *la* acción principal (lima) de
  la ficha, entre "Solicitar servicio" y abrir chat — la regla de interfaz 2 exige una sola,
  y con dos candidatas hay que elegir.
- `/servicios/publicar` **se queda** como ruta de respaldo para quien llegue con
  `?proveedor=<id>` desde fuera de la ficha (un enlace compartido) — usa el mismo componente
  extraído, no una copia.

## 3. Pasos de implementación (Antigravity)

- [ ] **Paso 1 [Extraer el selector]:** saca el bloque de selección de oficio + envío de
      `formulario-publicar-servicio.tsx` a un componente compartido.
- [ ] **Paso 2 [Ficha absorbe pedir]:** embebe ese componente en `prestador/[id]/page.tsx`,
      retira el botón único de `barra-contacto.tsx`, decide la acción principal de la
      pantalla.
- [ ] **Paso 3 [Tarjeta de listado]:** "Ver perfil", precio en rango.
- [ ] **Paso 4 [Qué hace / Qué vende]:** ajuste visual según el mockup.
- [ ] **Paso 5:** confirma que `/servicios/publicar?proveedor=<id>` sigue funcionando de
      punta a punta, usando el componente compartido.

## 4. Criterios de aceptación

- Desde `/prestador/[id]` se puede elegir un oficio y solicitar el servicio sin navegar a
  otra ruta.
- `/servicios/publicar?proveedor=<id>` sigue funcionando para quien llega de fuera.
- El precio con techo se ve como "Desde $X hasta $Y" en la tarjeta del listado y en la ficha;
  sin techo, sigue siendo "Desde $X" sin cambios.
- El botón "Ver ficha" del listado ahora dice "Ver perfil".

## 5. Verificación y puerta de calidad

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] Probar el flujo completo: buscar → ver ficha → pedir servicio, sin salir de la ficha.
- [ ] Probar `/servicios/publicar?proveedor=<id>` por separado (ruta de respaldo).
- [ ] Un prestador con un solo oficio y uno con varios — el selector se comporta igual que
      hoy en `formulario-publicar-servicio.tsx` (una sola opción).
- [ ] Sin warnings de build.
- [ ] Aprobación del `git diff` por Claude Code.

## 6. Notas y bloqueos

- Si extraer el selector resulta más complejo de lo esperado (props muy distintas entre el
  contexto de la ficha y el de `/servicios/publicar`), repórtalo aquí en vez de duplicar la
  lógica silenciosamente — es justo lo que el ADR 0023 pidió evitar.
