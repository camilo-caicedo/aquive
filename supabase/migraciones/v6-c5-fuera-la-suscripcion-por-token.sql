-- =====================================================================
-- v6 · Fase C · 5 — se retira `push_suscripciones`
--
-- Era la suscripción a avisos de UNA solicitud, identificada por el token
-- de esa solicitud. El ADR 0006 borró los tokens, y con ellos la única
-- pantalla que la llenaba: `<ActivarAvisos>` no tenía un solo importador
-- —su único rastro era un comentario— así que la tabla nunca recibió una
-- fila. Cero, comprobado antes de borrarla.
--
-- Y el único envío que la leía, `notificarRespuesta`, colgaba de un Route
-- Handler que también se va: `/api/respuestas`, cuya pantalla —
-- `/responder/[codigo]`— tampoco existía.
--
-- La suscripción que sí sirve es `push_ofertadores`: cuelga de `perfil_id`
-- y por tanto vale para todo lo que le pase a esa persona —un mensaje de
-- chat, una respuesta a lo que pidió, una solicitud nueva en sus
-- municipios— y sobrevive a que la solicitud que la originó se borre. Es
-- la que el ADR 0006 pide: una sola manera de ser dueño de algo.
--
-- ⚠ El nombre `push_ofertadores` se queda por ahora aunque ya no sea solo
-- de ofertadores. Renombrar una tabla toca su RPC, sus políticas y el
-- esquema generado, y no arregla nada: queda escrito aquí para cuando haya
-- otra razón para tocarla.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

drop function if exists public.guardar_push(uuid, text, text, text);
drop function if exists public.guardar_push(text, text, text, text);
drop table if exists public.push_suscripciones;

-- Comprobar:
--   select tablename from pg_tables
--    where schemaname = 'public' and tablename like 'push%';
--   -- solo push_ofertadores
