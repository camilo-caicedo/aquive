-- =====================================================================
-- v6 · Fase B · 9 — se retira `crear_proveedor_asistido`
--
-- Era la última puerta de alta que seguía creando una ficha SIN cuenta,
-- con un token en `proveedores.token_hash`. El ADR 0006 borró esa
-- columna, así que la función llevaba desde entonces muriendo con
-- «column token_hash of relation proveedores does not exist» en cada
-- intento — y el enlace que el panel entregaba después,
-- `/servicios/mi-perfil/<token>`, apunta a una ruta que ese mismo ADR
-- también borró.
--
-- Su reemplazo es `servicios.altaAsistida` del contrato, en
-- `src/server/servicios/alta-asistida.ts`. Hace lo que el ADR 0006 dijo:
-- crea una CUENTA de verdad con su `perfil_id` y su código de acceso, el
-- mismo que reparte `/admin/cuentas` y que se canjea en `/entrar/<codigo>`.
-- Una sola manera de ser dueño de algo.
--
-- Sube al dominio y no se arregla aquí por el ADR 0001: crear la cuenta
-- necesita la API de administración de Supabase Auth, que no existe desde
-- PL/pgSQL, y el rollback de esa cuenta si la ficha falla tampoco.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

drop function if exists public.crear_proveedor_asistido(
  uuid, text, text, text, text, text, uuid, text, text[], jsonb, text);

-- Comprobar que no queda ninguna función tocando `proveedores.token_hash`:
--
--   select p.proname from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.prosrc like '%token_hash%';
--
-- Lo que salga tiene que ser de `pqr` o de `solicitudes`, no de
-- `proveedores`. `pqr.token_hash` es la excepción legítima del ADR 0006:
-- es el canal de habeas data y no puede exigir cuenta.
