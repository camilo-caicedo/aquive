-- =====================================================================
-- v2 · Fase B · 2 — lo que encontró la revisión de seguridad
--
-- Cuatro cosas, en orden de gravedad.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. El cruce se conducía desde el lado caro
--
-- `sp.item_ids && p_item_ids` filtra sobre una columna CALCULADA de la
-- vista: ningún índice puede servirla, así que había que construir
-- `item_ids` —una subconsulta— para cada solicitud abierta, y solo
-- después descartar. Y para las que sobrevivían, otras tres subconsultas.
-- Dos recorridos completos por cada carga de la pantalla, en un endpoint
-- que llama `anon` sin Turnstile.
--
-- Se le da la vuelta: se arranca desde `solicitud_items`, que es donde
-- está el dato y donde un índice sí sirve, se agrupa, y solo entonces se
-- une con la vista. Las columnas caras se calculan únicamente para las
-- solicitudes que ya sabemos que calzan.
-- ---------------------------------------------------------------------

create index if not exists idx_items_item on public.solicitud_items(item_id)
  where item_id is not null;

create or replace function public.solicitudes_que_calzan(
  p_item_ids  text[],
  p_municipio text default null,
  p_limite    integer default 20,
  p_desde     integer default 0
)
returns table (
  id               uuid,
  codigo           text,
  municipio        text,
  municipio_nombre text,
  barrio           text,
  categoria        text,
  nota             text,
  creada_at        timestamptz,
  confirmada_at    timestamptz,
  expira_at        timestamptz,
  horas_sin_confirmar numeric,
  num_respuestas   bigint,
  items            jsonb,
  coincidencias    integer
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 20), 1), 50);
  v_desde  integer := least(greatest(coalesce(p_desde, 0), 0), 10000);
begin
  if p_item_ids is null or cardinality(p_item_ids) = 0 then
    return;
  end if;
  if cardinality(p_item_ids) > 12 then
    raise exception 'Puedes marcar máximo 12 cosas a la vez';
  end if;

  return query
  with calces as (
    select si.solicitud_id, count(*)::integer as n
      from public.solicitud_items si
     where si.item_id = any(p_item_ids)
     group by si.solicitud_id
  )
  select sp.id, sp.codigo, sp.municipio, sp.municipio_nombre, sp.barrio,
         sp.categoria, sp.nota, sp.creada_at, sp.confirmada_at, sp.expira_at,
         sp.horas_sin_confirmar, sp.num_respuestas, sp.items, c.n
    from calces c
    join public.solicitudes_publicas sp on sp.id = c.solicitud_id
   where p_municipio is null or sp.municipio = p_municipio
   order by c.n desc, sp.creada_at desc
   limit v_limite offset v_desde;
end;
$$;

grant execute on function public.solicitudes_que_calzan(text[],text,integer,integer)
  to anon, authenticated;

create or replace function public.municipios_que_calzan(p_item_ids text[])
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'codigo_dane', t.municipio,
           'nombre',      t.municipio_nombre,
           'total',       t.total
         ) order by t.municipio_nombre), '[]'::jsonb)
  from (
    select sp.municipio, sp.municipio_nombre, count(*) as total
      from (
        select distinct si.solicitud_id
          from public.solicitud_items si
         where p_item_ids is not null
           and cardinality(p_item_ids) between 1 and 12
           and si.item_id = any(p_item_ids)
      ) c
      join public.solicitudes_publicas sp on sp.id = c.solicitud_id
     group by sp.municipio, sp.municipio_nombre
     -- Cota dura: el desplegable no puede crecer sin techo, y sin ella
     -- esta función agregaba la vista entera en cada llamada anónima.
     limit 100
  ) t;
$$;

grant execute on function public.municipios_que_calzan(text[]) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. A quién avisar, resuelto en la base
--
-- Antes se traían todos los `ofrecimientos` de los perfiles del municipio
-- y se cruzaba en TypeScript. Dos fallos silenciosos ahí:
--
--   · PostgREST corta en 1000 filas —el mismo tope que obligó a crear
--     `listar_municipios`— y la llave de servicio no exime. Con 150
--     perfiles de 10 ítems, la lista llegaba truncada y sin orden: alguien
--     con inventario podía quedar clasificado como "tiene, pero no calza"
--     y perderse justo el aviso que le interesaba.
--   · `.in('perfil_id', [...])` mete todos los uuid en el query string de
--     un GET. Con unos cientos de perfiles la URL revienta, la respuesta
--     vuelve nula, y el filtro desaparece entero sin ningún síntoma.
--
-- De paso deja de mandar uuid de personas por la URL (regla 6).
--
-- `tiene_inventario` NO mira `disponible`: quien marcó todo lo suyo como
-- no disponible está diciendo "ahora no", no "no me llenaste el perfil".
-- Devolverlo a la rama de "avísame todo" era lo contrario de lo que pidió.
-- ---------------------------------------------------------------------

create or replace function public.destinatarios_aviso(
  p_municipio text,
  p_item_ids  text[]
)
returns table (
  suscripcion_id uuid,
  endpoint       text,
  p256dh         text,
  auth_key       text,
  calza          boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select po.id, po.endpoint, po.p256dh, po.auth_key,
         coalesce(cal.calza, false)
    from public.push_ofertadores po
    join public.perfiles p on p.id = po.perfil_id
    left join lateral (
      select bool_or(o.item_id = any(p_item_ids)) as calza,
             count(*) > 0                        as tiene
        from public.ofrecimientos o
       where o.perfil_id = p.id
    ) inv on true
    left join lateral (
      select bool_or(o.item_id = any(p_item_ids)) as calza
        from public.ofrecimientos o
       where o.perfil_id = p.id and o.disponible
    ) cal on true
   where p.suspendido = false
     and p_municipio = any(p.municipios)
     -- Sin inventario declarado: recibe todo lo de sus municipios, como
     -- siempre. El inventario es opcional y no puede volverse el precio de
     -- enterarse.
     and (
       coalesce(inv.tiene, false) = false
       -- Con inventario: solo si la solicitud pide algo suyo…
       or coalesce(cal.calza, false)
       -- …o si la solicitud no trae ningún ítem del catálogo con el que
       -- cruzar, que pasa cuando todo lo que pidió es una sugerencia. Sin
       -- esto, quien se tomó el trabajo de declarar qué tiene era el único
       -- que no se enteraba.
       or p_item_ids is null
       or cardinality(p_item_ids) = 0
     );
$$;

revoke execute on function public.destinatarios_aviso(text,text[])
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. `solicitud_items` estaba abierta de par en par
--
-- Política `using (true)` y sin `revoke`, mientras que `solicitudes` sí
-- está revocada. O sea que `GET /rest/v1/solicitud_items?select=*`
-- devolvía los ítems de TODAS las solicitudes, incluidas las ya cumplidas
-- y las vencidas que el job todavía no ha borrado — justo lo que la vista
-- pública oculta a propósito.
--
-- No hay dato personal ahí, pero si el criterio del proyecto es que la
-- vista ES la frontera de seguridad, esto lo contradecía. Ningún archivo
-- de `src/` lee esta tabla directamente: todo pasa por la vista o por RPC,
-- que son `security definer` y siguen funcionando igual.
-- ---------------------------------------------------------------------

drop policy if exists "items lectura publica" on public.solicitud_items;
revoke all on public.solicitud_items from anon, authenticated;

-- Comprobar:
--   select has_table_privilege('anon','public.solicitud_items','SELECT');  -- f
--   select codigo, coincidencias from public.solicitudes_que_calzan(array['agua','arroz']);
