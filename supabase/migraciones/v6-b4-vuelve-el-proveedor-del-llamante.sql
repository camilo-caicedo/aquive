-- =====================================================================
-- v6 · Fase B · 4 — vuelve `proveedor_del_llamante`, que se llevó por
--                    delante a once funciones
--
-- Salió al probar el tablero de solicitudes, que devolvía siempre vacío:
--
--     ERROR: function public.proveedor_del_llamante(text) does not exist
--
-- La función resolvía «¿qué ficha es la de quien llama?» de dos maneras:
-- por `proveedores.token_hash` si venía token, y por `auth.uid()` si no.
-- El ADR 0006 borró `token_hash`, así que `v5-b1` borró la función —bien
-- borrada, apuntaba a una columna que ya no existe— y **no puso nada en
-- su sitio**. Once funciones la llamaban:
--
--   borrar_proveedor · borrar_referencia · crear_codigo_servicio
--   crear_referencia · guardar_proveedor · mi_proveedor · mis_referencias
--   mis_servicios · responder_resena · responder_servicio
--   solicitudes_de_servicio
--
-- Es decir: publicar o editar una ficha, responder una solicitud, generar
-- un código de servicio, replicar una reseña, ver las propias referencias
-- y el tablero entero. Todo el lado de quien ofrece.
--
-- Y no daba error en pantalla en la mayoría de los casos: el cliente de
-- Supabase devuelve `{ data: null, error }`, y el código de la pantalla
-- hace `?? null` o `?? []`. Así que `mi_proveedor` decía «no tienes
-- ficha» a quien sí la tiene, y el tablero decía «no hay solicitudes».
--
-- ⚠ La búsqueda que encontró esto miraba nombres de TABLAS borradas
-- (`v6-b1`, `v6-b2`). Faltaba mirar nombres de FUNCIONES borradas. Para
-- la próxima vez que se borre algo, las dos:
--
--   select p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.prosrc like '%lo_que_se_borro%';
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Una sola manera de ser dueño de una ficha: `perfil_id` (ADR 0006).
--
-- `p_token` se conserva en la firma y se IGNORA. No es descuido: las once
-- funciones que la llaman le pasan su propio `p_token`, y quitarlo aquí
-- obligaría a reescribir las once en la misma migración para arreglar un
-- fallo que ya está en producción de pruebas. La deuda queda escrita:
-- cuando esas funciones se muden al contrato de oRPC —que es a donde van,
-- por el ADR 0001— el parámetro se va con ellas.
--
-- Se queda `security definer` y sin `execute` para nadie: es una función
-- interna, la llaman otras RPC, y no tiene por qué ser invocable desde
-- fuera.
-- ---------------------------------------------------------------------

create or replace function public.proveedor_del_llamante(p_token text default null)
returns uuid
language sql
stable
security definer
set search_path = ''
as $function$
  select p.id
  from public.proveedores p
  where p.perfil_id = auth.uid()
    and auth.uid() is not null
  limit 1;
$function$;

revoke execute on function public.proveedor_del_llamante(text) from public, anon, authenticated;

-- Comprobar que ya no queda ninguna función llamando a algo que no existe:
--
--   select p.proname, x.name
--     from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--     cross join lateral (values ('conversaciones'), ('accesos_identidad'),
--                                ('identidades'), ('token_hash')) as x(name)
--    where n.nspname = 'public' and p.prosrc like '%' || x.name || '%';
--
-- `pqr.token_hash` es la excepción legítima y la única que debe salir.
