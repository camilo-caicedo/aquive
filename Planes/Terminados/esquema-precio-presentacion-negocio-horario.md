# TASK_PLAN: Esquema — precio_hasta, tope de presentación, nombre de negocio y horario exacto

**Estado:** LISTO PARA AUDITORÍA (ejecutado por el Arquitecto, sin pasar por Antigravity —
Antigravity no tiene acceso a la base de datos)
**Arquitecto:** Claude Code
**Constructor:** N/A — tarea de esquema y contrato, ejecutada por el Arquitecto

## Trazabilidad

- **ADR:** `docs/decisiones/0026-el-precio-admite-un-techo.md`,
  `docs/decisiones/0027-nombre-de-negocio-y-horarios-por-hora.md`
- **Regla / calibración:** `AGENTS.md` § "Los campos libres tienen tope y filtro" (300→200)

## 1. Análisis de impacto en el sistema

- **Módulo de dominio:** `src/server/servicios/`
- **Archivos modificados:**
  - `src/db/generado/schema.ts` — columnas `precioHasta`, `nombreNegocio`, `horaDesde`,
    `horaHasta`; `CHECK` nuevos; vistas `proveedorOficiosPublicos` y `proveedoresPublicos`
    ampliadas; tope de `descripcion` 300→200 en `proveedores` y `perfiles`.
  - `src/contrato/servicios.ts` — `OficioDeProveedor.precio_hasta`, `Ficha.hora_desde`,
    `Ficha.hora_hasta`, `Ficha.nombre_negocio`.
  - `src/contrato/cuentas.ts` — `guardarMia.descripcion` tope 300→200.
  - `src/lib/servicios.ts` — `precioLegible`/`conMonto` admiten rango.
  - `src/lib/types.ts` — `OficioProveedorInput.precio_hasta`, `MiProveedor` con los tres
    campos nuevos, `Database['public']['Views']` y `Functions.guardar_proveedor.Args`
    ampliados.
  - `src/server/servicios/consultas.ts` — `ficha()` y los dos listados que arman
    `EnListado['oficios']` seleccionan y mapean `precio_hasta`; `ficha()` además
    `hora_desde`/`hora_hasta`/`nombre_negocio`.
- **Archivos nuevos:**
  - `supabase/migraciones/v6-g1-el-precio-admite-un-techo.sql`
  - `supabase/migraciones/v6-g2-nombre-de-negocio-y-horario-exacto.sql`
  - `supabase/migraciones/v6-g3-la-presentacion-baja-a-200.sql`
  - `supabase/migraciones/v6-g4-el-rpc-de-la-ficha-aprende-los-campos-nuevos.sql`
- **Dependencias nuevas:** ninguna.

## 2. Blueprint arquitectónico y contratos

- **Panorama conceptual:** ver los dos ADR citados arriba.
- **Contratos:** `precio_hasta` opcional en `OficioDeProveedor`/`OficioProveedorInput`;
  `nombre_negocio`/`hora_desde`/`hora_hasta` opcionales en `Ficha`/`MiProveedor`. Todo
  aditivo — ningún tipo existente pierde ni cambia un campo.
- **Seguridad y autorización:** sin cambios — las mismas vistas públicas siguen aplicando
  la regla de producto 7 y los consentimientos de mapa/dirección; los campos nuevos no
  llevan consentimiento propio porque no son de la misma naturaleza (no son nombre/teléfono/
  foto/ubicación de una persona).
- **Mínimo legal y reglas de producto tocadas:** regla de producto 1 (rango de precio, ADR
  0025), regla de producto 4 (tope de presentación, tabla). Ninguna del mínimo legal.

## 3. Pasos ejecutados

- [x] **Paso 1 [Migraciones]:** `v6-g1`, `v6-g2`, `v6-g3`, `v6-g4` escritas, con su
      `CHECK`, su `create or replace view` (columnas nuevas al final, sin `drop cascade`) y
      su `create or replace function` para `guardar_proveedor`/`mi_proveedor`.
- [x] **Paso 2 [Esquema Drizzle]:** `src/db/generado/schema.ts` actualizado a mano —
      import `time` agregado, columnas y `CHECK` nuevos, las dos vistas ampliadas.
- [x] **Paso 3 [Contrato]:** `src/contrato/servicios.ts`, `src/contrato/cuentas.ts`
      actualizados.
- [x] **Paso 4 [Tipos de la RPC cruda]:** `src/lib/types.ts` actualizado —
      `OficioProveedorInput`, `MiProveedor`, el bloque `Database['public']['Views']` y
      `Functions.guardar_proveedor.Args`.
- [x] **Paso 5 [Dominio de lectura]:** `src/server/servicios/consultas.ts` y
      `src/lib/servicios.ts` (`precioLegible`) actualizados.

## 4. Criterios de aceptación

- Un oficio sin `precio_hasta` sigue mostrando «Desde $X» exactamente como antes (sin
  regresión).
- Un oficio con `precio_hasta > precio_desde` muestra «Desde $X hasta $Y».
- `guardar_proveedor` sin los tres parámetros nuevos (llamada vieja hipotética) sigue
  funcionando — son `default null` / opcionales.
- El tope de 200 caracteres se aplica en el `CHECK` de las dos tablas, en el mensaje de
  error de la RPC y en el contrato `cuentas.guardarMia`.

## 5. Verificación y puerta de calidad

- [ ] **Pendiente, no ejecutado en esta sesión:** aplicar las 4 migraciones contra la base
      de pruebas de Supabase (`mcp__claude_ai_Supabase__apply_migration` o el CLI), y correr
      `npm run typecheck` para confirmar que `schema.ts` y `types.ts` compilan contra el
      resto del código. **No se aplicó todavía porque falta confirmación explícita del
      usuario para tocar la base real — ver aviso al cierre de esta sesión.**
- [ ] `npm run lint`.
- [ ] Comprobaciones SQL incluidas al final de cada migración (recuento de filas fuera de
      rango, que debe dar 0).

## 6. Notas y bloqueos

- **La UI todavía no consume nada de esto.** `formulario-proveedor.tsx` sigue mandando
  `maxLength={300}` y el contador «X/300», y no manda `precio_hasta` ni los campos de
  negocio/horario — eso es explícitamente tarea de Antigravity en
  `Planes/ficha-listado-rediseno-y-pedir-inline.md` y
  `Planes/formulario-proveedor-3-pasos.md`, que dependen de este plan.
- **Las migraciones no se han aplicado a ninguna base real todavía** — están escritas y
  revisadas, listas para aplicar cuando el usuario confirme.
