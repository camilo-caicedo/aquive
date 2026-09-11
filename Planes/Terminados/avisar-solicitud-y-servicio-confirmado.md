# TASK_PLAN: Push para solicitud aceptada/rechazada y servicio confirmado

**Estado:** LISTO PARA EJECUCIÓN — depende de `Planes/Terminados/campanita-mis-avisos-reescrita.md`
**Arquitecto:** Claude Code
**Constructor:** Antigravity

## Trazabilidad

- **Fuente:** revisión conjunta con el usuario, 2026-09-10 — "el fallo más grande de la app
  son las notificaciones". Investigación confirmó que `avisar()` (push Web Push) solo se
  llama para mensaje de chat nuevo (`src/server/chat/hilo.ts:372`); ningún otro evento manda
  push.
- **Sin ADR** — es llenar un hueco de cobertura con el patrón que ya existe (`avisar()` ya
  funciona, ya se llama desde TypeScript server-side para el chat), no una decisión nueva.
- **Precondición:** `solicitudes_servicio.actualizado_at` ya existe (migración
  `v6-h1-la-campanita-vuelve-a-sonar.sql`, ya aplicada). Este plan **no** toca base de datos,
  pero SÍ tiene que escribir en esa columna nueva desde TypeScript (ver Sección 2).

## 1. Análisis de impacto en el sistema

- **Módulo de dominio:** `src/server/servicios/solicitudes.ts` (función `cambiarEstado`).
- **Archivos a modificar:**
  - `src/server/servicios/solicitudes.ts`
  - `src/app/api/servicios/confirmar/route.ts`
  - `src/app/perfil/avisos/interruptor.tsx` — actualizar la lista de qué SÍ llega hoy.
- **Archivos nuevos:** ninguno.
- **Dependencias nuevas:** ninguna.

## 2. Blueprint arquitectónico y contratos

### Parte A — Solicitud aceptada/rechazada

`src/server/servicios/solicitudes.ts`, función `cambiarEstado` (líneas ~341-371):

1. El `select` de la línea ~349-359 solo trae `estado`. Amplíalo para traer también
   `solicitudesServicio.perfilId` (quien PIDIÓ — es a quien hay que avisar, no al prestador
   que está haciendo el cambio) y `solicitudesServicio.oficioId` o lo que necesites para el
   texto del aviso.
2. El `update` de la línea ~366-369 escribe `estado`. Agrégale `actualizadoAt: new
   Date().toISOString()` (o el equivalente con `sql\`now()\`` si el patrón del proyecto lo
   prefiere — revisa cómo lo hacen otras escrituras similares en el mismo archivo). **Esto
   no es opcional**: sin esta columna, `mis_avisos()` (la campanita, ya reescrita) nunca ve
   este evento.
3. Después del `update`, si `siguiente` es `'aceptada'` o `'rechazada'`, llama:
   ```ts
   import { avisar } from '@/server/avisos/push'
   // ...
   await avisar(db, fila.perfilId, {
     cuerpo: siguiente === 'aceptada'
       ? 'El prestador aceptó tu solicitud.'
       : 'El prestador rechazó tu solicitud.',
     url: '/mis-solicitudes',
     tag: `solicitud-${id}`,
   })
   ```
   Sigue el mismo patrón que `src/server/chat/hilo.ts:372-378` — `avisar()` ya traga sus
   propios errores (es best-effort), no hace falta envolver en un `try/catch` aparte.
4. El texto del aviso tiene que ser idéntico —palabra por palabra— al que ya escribe
   `mis_avisos()` para este mismo evento (`'El prestador aceptó tu solicitud.'` /
   `'El prestador rechazó tu solicitud.'`, en la migración `v6-h1`), para que el push y la
   campanita digan lo mismo si alguien ve los dos.

### Parte B — Servicio confirmado con código

`src/app/api/servicios/confirmar/route.ts` (líneas ~55-63 hacen el `.rpc('confirmar_y_resenar', ...)`):

1. Tras un resultado exitoso del RPC, necesitas el `perfil_id` del prestador dueño del
   código para avisarle. La RPC devuelve `void` o un resultado que puede no traer ese dato
   directo — revisa qué devuelve exactamente `confirmar_y_resenar` (búscala en
   `supabase/migraciones/*.sql`, la definición más reciente). Si no trae `proveedor_id` /
   `perfil_id`, haz una consulta aparte con `db` (ya está importado en route handlers
   hermanos como `api/perfil/route.ts`) usando el dato que sí tengas de la respuesta o del
   propio código confirmado.
2. Llama `avisar()` con el mismo texto que usa `mis_avisos()` para este evento: `'Alguien
   confirmó un servicio con tu código y dejó su reseña.'`, `url: '/perfil/resenas'`,
   `tag` con el id del servicio confirmado.
3. Este endpoint corre sin sesión de usuario (Turnstile en vez de auth) — usa el cliente que
   ya use el route handler (`createServiceClient()` u otro `db` de servidor), no el de
   sesión.

### Parte C — `interruptor.tsx` dice la verdad

`src/app/perfil/avisos/interruptor.tsx:33-53` documenta qué SÍ y qué NO llega. Actualiza:
- "Alguien usó tu código" pasa de `hay: false` a `hay: true`.
- Si no existe ya una entrada para "Te aceptaron o rechazaron una solicitud", agrégala con
  `hay: true`.
- No toques la entrada de "Novedades de AquíVe" — sigue sin existir, fuera de alcance de
  este plan.

## 3. Pasos de implementación (Antigravity)

- [ ] **Paso 1:** `cambiarEstado` en `solicitudes.ts` — trae `perfilId`, escribe
      `actualizadoAt`, llama `avisar()` tras aceptar/rechazar.
- [ ] **Paso 2:** `api/servicios/confirmar/route.ts` — resuelve el `perfil_id` del
      prestador, llama `avisar()` tras confirmar.
- [ ] **Paso 3:** `interruptor.tsx` — refleja la cobertura real.

## 4. Criterios de aceptación

- Al aceptar o rechazar una solicitud, quien la pidió recibe un push (si tiene una
  suscripción activa) y ve el aviso en la campanita al recargar.
- Al confirmar un servicio con código, el prestador dueño del código recibe un push y ve el
  aviso en la campanita.
- Los textos del push y de la campanita, para el mismo evento, son idénticos.
- `interruptor.tsx` ya no promete menos de lo que la app hace.

## 5. Verificación y puerta de calidad

- [x] `npm run lint` (verificado por el Arquitecto)
- [x] `npm run typecheck` (verificado por el Arquitecto)
- [ ] Probar de punta a punta: aceptar una solicitud con dos cuentas de prueba (una pide,
      otra presta), confirmar un servicio con un código real. **Pendiente** — no se probó
      con datos reales en esta sesión.
- [x] Sin warnings de build (verificado por el Arquitecto).
- [x] Aprobación del `git diff` por Claude Code.

## 6. Notas y bloqueos

- Si `confirmar_y_resenar` no devuelve nada útil para resolver el `perfil_id` sin una
  consulta extra, está bien hacer esa consulta — no es una vuelta grande, y el arquitecto la
  revisará contra la regla de "ningún acceso a datos desde el navegador" (esto corre en el
  servidor, así que no debería chocar). Confirmado en la auditoría: `confirmar_y_resenar` SÍ
  devuelve `proveedor_id` (`v3-s6-resenas.sql:199-202`), así que no hizo falta la consulta
  de respaldo.
- Diff auditado sin correcciones: `cambiarEstado` trae `perfilId`, escribe `actualizadoAt`,
  el texto del push coincide palabra por palabra con `mis_avisos()`; el route handler de
  confirmar resuelve el `perfil_id` real antes de avisar; `interruptor.tsx` refleja la
  cobertura real.
