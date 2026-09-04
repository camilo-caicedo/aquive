-- =====================================================================
-- v6 · Fase C · 7 — se retiran las funciones que no llama nadie
--
-- Salieron de cruzar el catálogo de Postgres contra el código: para cada
-- función de `public`, ¿la llama otra función, una vista, un trigger o
-- algún archivo de `src/`?
--
--   select p.proname from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.prokind = 'f'
--      and not exists (select 1 from pg_proc q ... q.prosrc like '%'||p.proname||'%')
--      and not exists (select 1 from pg_trigger t where t.tgfoid = p.oid)
--      and not exists (select 1 from pg_views v ... v.definition like ...);
--
-- Las que quedan abajo no las llama nada, por ninguna vía. Casi todas
-- tienen la misma historia: su equivalente subió al contrato de oRPC por
-- el ADR 0001 y nadie borró la de aquí. Dos están además **rotas** contra
-- columnas que ya no existen.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Rotas contra `solicitudes.token_hash`, que borró el ADR 0006
--
-- Las dos hacen `where s.token_hash = encode(digest(p_token,...))` sobre
-- una columna que no existe: cada llamada moría con «column does not
-- exist». No las llamaba nadie, así que nunca se notó.
-- ---------------------------------------------------------------------

drop function if exists public.destapar_contacto(text, uuid);
drop function if exists public.ofertadores_que_calzan(text, integer, integer);
drop function if exists public.contacto_solicitante(text);

-- Y la tabla del rastro de esos destapes, con cero filas: no hubo ninguno
-- que registrar.
drop table if exists public.destapes_contacto;

-- El contacto suelto de quien pedía sin cuenta. Cero filas desde el ADR
-- 0006 —quien pide tiene cuenta y su teléfono no se publica—, y era además
-- la única tabla de `public` sin RLS.
drop table if exists public.solicitudes_contacto cascade;

-- ---------------------------------------------------------------------
-- 2 · Reemplazadas por un procedimiento del contrato (ADR 0001)
-- ---------------------------------------------------------------------

drop function if exists public.crear_reporte(text, uuid, text, text);
drop function if exists public.ficha_proveedor(uuid);
drop function if exists public.guardar_zona(uuid, text, text, boolean);
drop function if exists public.guardar_oficio(text, text, text, text, integer, boolean);
drop function if exists public.crear_item_catalogo(text, text, text, integer);

-- ---------------------------------------------------------------------
-- 3 · Del flujo acompañado y de la movilidad, que nunca se enchufaron
-- ---------------------------------------------------------------------

drop function if exists public.hash_documento(text);
drop function if exists public.destinatarios_respondieron(uuid);
drop function if exists public.mi_movilidad();
drop function if exists public.movilidad_solicitud(uuid);
drop function if exists public.accesos_a_referencias();
drop function if exists public.generar_codigo();

-- Comprobar que no queda ninguna sin llamador:
--   la consulta de arriba, otra vez. Lo que salga tiene que ser algo que
--   llame `src/` — el catálogo no ve el código.

-- ---------------------------------------------------------------------
-- 4 · `solicitudes_admin` deja de leer `solicitudes_contacto`
--
-- Era el único caller que quedaba de esa tabla. Devolvía un objeto
-- `contacto` que desde el ADR 0006 siempre venía nulo —quien pide tiene
-- cuenta y su teléfono no se publica—, y la pantalla lo pintaba dentro de
-- un `&&` que nunca era cierto.
-- ---------------------------------------------------------------------

create or replace function public.solicitudes_admin()
returns jsonb
language sql
stable
security definer
set search_path to ''
as $function$
  select case when not public.es_admin(auth.uid()) then '[]'::jsonb
         else coalesce((
           select jsonb_agg(jsonb_build_object(
             'codigo',      s.codigo,
             'municipio',   m.nombre || ', ' || m.departamento,
             'barrio',      s.barrio,
             'categoria',   s.categoria,
             'nota',        s.nota,
             'nota_admin',  s.nota_admin,
             'estado',      s.estado,
             'creada_at',   s.creada_at,
             'expira_at',   s.expira_at,
             'respuestas',  (select count(*) from public.respuestas r where r.solicitud_id = s.id),
             'items',       (select coalesce(jsonb_agg(jsonb_build_object(
                                      'nombre',   coalesce(ci.nombre, sg.nombre_propuesto),
                                      'cantidad', si.cantidad,
                                      'unidad',   coalesce(ci.unidad, sg.unidad_sugerida, 'unidad'))
                                    order by coalesce(ci.orden, 9999)), '[]'::jsonb)
                               from public.solicitud_items si
                               left join public.catalogo_items ci   on ci.id = si.item_id
                               left join public.sugerencias_item sg on sg.id = si.sugerencia_id
                              where si.solicitud_id = s.id)
           ) order by s.creada_at desc)
             from public.solicitudes s
             join public.municipios m on m.codigo_dane = s.municipio
         ), '[]'::jsonb)
         end;
$function$;

revoke execute on function public.solicitudes_admin() from public, anon;
grant  execute on function public.solicitudes_admin() to authenticated;
