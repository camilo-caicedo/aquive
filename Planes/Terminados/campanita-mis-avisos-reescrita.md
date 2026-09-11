# TASK_PLAN: La campanita — `mis_avisos()` deja de devolver `[]` siempre

**Estado:** LISTO PARA AUDITORÍA (ejecutado por el Arquitecto, sin pasar por Antigravity —
Antigravity no tiene acceso a la base de datos)
**Arquitecto:** Claude Code
**Constructor:** N/A — tarea de esquema, ejecutada por el Arquitecto

## Trazabilidad

- **Fuente:** revisión conjunta con el usuario, 2026-09-10 — "el fallo más grande de la app
  son las notificaciones".
- **Hallazgo de sesión:** `mis_avisos()` (la función detrás de la campanita) quedó como
  `select '[]'::jsonb;` desde `v6-f3-fuera-el-tablero-de-pedidos.sql` (ADR 0016) — un
  placeholder que nunca se completó. `estado_encabezado()` cuenta sobre esa lista, así que
  el punto rojo de la campana lleva apagado para todo el mundo desde entonces. No es una
  cobertura floja, es un sistema completo sin encender.
- **Sin ADR** — es completar una función que quedó a medias, no cambiar una regla dura.

## 1. Análisis de impacto en el sistema

- **Archivos nuevos:** `supabase/migraciones/v6-h1-la-campanita-vuelve-a-sonar.sql`.
- **Archivos modificados:**
  - `src/db/generado/schema.ts` — columna `actualizadoAt` en `solicitudesServicio`.
  - `src/lib/types.ts` — `Aviso['tipo']` gana seis valores nuevos.
  - `src/components/boton-avisos.tsx` — `ICONO_AVISO` pasa a `Partial<Record<...>>`: el
    `Record<>` exhaustivo ya no compilaba con los tipos nuevos, y el propio comentario del
    archivo ya documentaba que el diseño real era "con fallback a un icono genérico", no
    "todos los tipos tienen que tener icono". Corrección mecánica, no elección de iconos
    nuevos — eso queda para quien construya la UI de cada evento, si se quiere.

## 2. Blueprint arquitectónico y contratos

`mis_avisos()` reescrita con cinco eventos reales, cada uno filtrado por `auth.uid()` y por
más nuevo que `avisos_vistos_at` de quien llama:

1. Solicitud aceptada/rechazada — para quien pidió.
2. Servicio confirmado con código — para el prestador (mismo momento que la reseña:
   `confirmar_y_resenar` hace las dos cosas en una transacción).
3. Referencia confirmada — para el prestador.
4. Teléfono verificado — para el prestador.
5. Ficha suspendida — para el prestador.

`solicitudes_servicio` no tenía ninguna columna de "cuándo cambió de estado" —
`revisada_at` es de la cola de moderación de `/admin`, no del momento en que el prestador
acepta o rechaza. Se agregó `actualizado_at`, `not null`, con las filas existentes
rellenadas con su `creada_at` (lo más cerca que hay, para que ninguna aparezca como "recién
pasada" el día del despliegue). Las otras cuatro tablas ya tenían el timestamp que hacía
falta (`servicios_prestados.confirmado_at`, `referencias.revisada_at`,
`proveedores.verificado_at`, `proveedores.actualizado_at`).

`marcar_avisos_vistos()` no se tocó — ya funcionaba, y sigue sirviendo igual.

## 3. Pasos ejecutados

- [x] Migración `v6-h1` escrita y aplicada en la base de pruebas (Aquive-Test).
- [x] Comprobación: 0 filas de `solicitudes_servicio` sin `actualizado_at`.
- [x] `src/db/generado/schema.ts` actualizado a mano.
- [x] `src/lib/types.ts`: `Aviso['tipo']` con los seis tipos nuevos; `respuesta`/`reporte` se
      quedan en la unión por compatibilidad, aunque ninguna función viva ya los emite.
- [x] `src/components/boton-avisos.tsx`: `ICONO_AVISO` a `Partial<Record<...>>`.

## 4. Criterios de aceptación

- `mis_avisos()` devuelve entradas reales para los cinco eventos, no `[]` siempre.
- `estado_encabezado()` (que no se tocó) vuelve a poder mostrar el punto rojo, porque ahora
  tiene datos reales sobre los que contar.
- Ningún tipo de aviso nuevo rompe `boton-avisos.tsx` en tiempo de compilación ni en
  ejecución (cae al icono genérico si no lo conoce).

## 5. Verificación y puerta de calidad

- [x] `npm run typecheck` — limpio.
- [x] `npx eslint` sobre los archivos tocados — limpio.
- [ ] **Pendiente:** probar `mis_avisos()` con datos reales de cada uno de los cinco eventos
      (queda para cuando `Planes/avisar-solicitud-y-servicio-confirmado.md` y el plan de los
      paneles de admin/aliado estén construidos y probados de punta a punta — hoy la
      función ya corre sin error, pero nadie ha disparado los cinco eventos en la base de
      pruebas todavía).

## 6. Notas y bloqueos

- La UI de la campanita (`boton-avisos.tsx`) no tiene iconos propios para los seis tipos
  nuevos — usa el fallback genérico (`Bell`) hasta que alguien decida qué icono le
  corresponde a cada uno. No bloqueante: es una mejora visual, no una corrección.
- Este plan es precondición de `Planes/avisar-solicitud-y-servicio-confirmado.md` y del plan
  de mover a servidor las tres acciones de admin/aliado (referencia, teléfono, suspensión).
