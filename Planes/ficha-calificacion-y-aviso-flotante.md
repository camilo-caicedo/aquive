# TASK_PLAN: Ficha — "Calificación" más prominente, y el aviso de dinero pasa a botón flotante

**Estado:** LISTO PARA EJECUCIÓN
**Arquitecto:** Claude Code
**Constructor:** Antigravity

## Trazabilidad

- **ADR:** `docs/decisiones/0022-la-calificacion-pesa-mas-en-la-ficha.md`
- No depende de las migraciones de esquema — trabaja con datos que la ficha ya trae.

## 1. Análisis de impacto en el sistema

- **Módulo de dominio:** ninguno — es presentación sobre datos que `ficha()` ya devuelve
  (`cumplimiento`, `trato`, `puntualidad`, `servicios_confirmados`, `total_resenas`).
- **Archivos a modificar:**
  - `src/app/prestador/[id]/page.tsx` — título de la sección (línea ~242) y su jerarquía
    visual (líneas ~253-263); el bloque del aviso "AquíVe no maneja dinero..." (línea
    ~235-240).
- **Archivos nuevos:** ninguno, salvo que el botón flotante de información necesite su
  propio componente pequeño reusable (evalúa si `HojaAccion` ya sirve tal cual).
- **Dependencias nuevas:** ninguna.

## 2. Blueprint arquitectónico y contratos

### Parte A — "Calificación"

- Cambia el título de la sección de **"Qué dice quien lo contrató"** a **"Calificación"**.
- Sube la prominencia visual del promedio (o su versión en estrellas) — puede pasar a
  compartir el mismo tamaño/peso que hoy tiene el conteo de servicios confirmados, o
  ubicarse primero visualmente.
- **No reduzcas el conteo de servicios confirmados por debajo de su tamaño actual.** La
  regla de producto 5 (ya actualizada en `AGENTS.md`) exige que el volumen siga siendo tan
  visible como hoy — lo que cambia es que el promedio deja de ser texto secundario, no que
  el volumen se achique.
- Las reseñas individuales debajo de este bloque (comentario, réplica) no cambian.

### Parte B — Aviso flotante

- Quita el bloque fijo con el texto completo de `NO_PAGUES_POR_ADELANTADO`
  (`src/lib/honestidad.ts`) de `app/prestador/[id]/page.tsx` (línea ~235-240).
- En su lugar, agrega un botón/ícono flotante (ⓘ), discreto, en la ficha. Al tocarlo, muestra
  el mismo texto completo — en una hoja inferior (`components/hoja-accion.tsx`) o un
  popover, lo que encaje mejor con el patrón ya usado en el proyecto para contenido
  secundario.
- **No toques** las otras dos apariciones del mismo texto: `src/components/directorio.tsx`
  (línea ~456-464) y `src/app/terminos/page.tsx` (línea ~180) — esas se quedan como están,
  visibles y completas.
- **No dupliques** el texto corto que ya muestra `barra-contacto.tsx` (líneas ~66-73) — esa
  barra fija sigue con su línea corta y su enlace a "Cómo cuidarte", sin cambios.

## 3. Pasos de implementación (Antigravity)

- [ ] **Paso 1 [Calificación]:** cambia el título y la jerarquía visual del bloque de
      reseñas en `prestador/[id]/page.tsx`.
- [ ] **Paso 2 [Aviso flotante]:** reemplaza el bloque fijo del aviso de dinero por el botón
      (ⓘ) + contenido en hoja inferior o popover.
- [ ] **Paso 3:** confirma con `grep` que `directorio.tsx` y `terminos/page.tsx` no fueron
      tocados.

## 4. Criterios de aceptación

- La sección de reseñas de la ficha se llama "Calificación" y el promedio tiene más
  prominencia visual que antes, sin que el conteo de servicios confirmados se vea más chico
  que hoy.
- El aviso "AquíVe no maneja dinero..." ya no aparece como bloque fijo en la ficha — aparece
  al tocar un botón/ícono de información, con el mismo texto completo.
- `/directorio` y `/terminos` siguen mostrando el aviso completo, sin cambios.

## 5. Verificación y puerta de calidad

- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] Revisar visualmente una ficha con reseñas y una sin ninguna (el bloque en cero debe
      seguir viéndose bien, per regla de producto 5).
- [ ] Áreas táctiles de 48px en el botón flotante (regla de accesibilidad).
- [ ] Aprobación del `git diff` por Claude Code.

## 6. Notas y bloqueos

- Ninguno conocido.
