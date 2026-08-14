-- =====================================================================
-- v2 · Fase B · 1 — el cruce inverso: "¿quién necesita lo que tengo?"
--
-- El obstáculo de esta fase no es el "sin JavaScript", es la fuente de
-- datos: el jsonb `items` de `solicitudes_publicas` es
-- {nombre, cantidad, unidad, por_confirmar} y **no trae `item_id`**, así
-- que no se puede filtrar por ítems marcados ni contar coincidencias.
--
-- Se agregan los dos arreglos al final de la vista —`create or replace
-- view` admite columnas nuevas ahí— y una RPC que hace el filtro y el
-- orden en SQL.
--
-- Por qué una RPC y no PostgREST a secas: filtrar sí se puede con
-- `.overlaps()`, pero **ordenar por cuántos ítems coinciden no**. Y ese
-- orden es la mitad del valor: una solicitud que pide cinco cosas que
-- tengo vale más que una que pide una. Ordenar en el cliente solo
-- ordenaría la página que ya se trajo.
--
-- No usa `v_cruces`: eso es del Flujo 2 y todavía no existe.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

create or replace view public.solicitudes_publicas as
select
  s.id,
  s.codigo,
  s.municipio,
  m.nombre as municipio_nombre,
  s.barrio,
  s.categoria,
  s.nota,
  s.creada_at,
  s.confirmada_at,
  s.expira_at,
  extract(epoch from (now() - s.confirmada_at)) / 3600 as horas_sin_confirmar,
  (select count(*) from public.respuestas r where r.solicitud_id = s.id) as num_respuestas,
  -- ⚠ `left join` porque un ítem sugerido no tiene fila en el catálogo, y
  -- `coalesce` sobre las TRES columnas, no solo sobre el nombre: la
  -- agregación usa `c.nombre`, `c.unidad` y `order by c.orden`. Con el
  -- left join a secas, `unidad` queda en NULL y `describirItem()` en
  -- src/lib/catalogo.ts renderiza "3 null de Crema dental" aquí, en el
  -- tablero público. Los sugeridos van al final: `coalesce(c.orden, 9999)`.
  (select coalesce(jsonb_agg(jsonb_build_object(
             'nombre',        coalesce(c.nombre, sg.nombre_propuesto),
             'cantidad',      si.cantidad,
             'unidad',        coalesce(c.unidad, sg.unidad_sugerida, 'unidad'),
             'por_confirmar', si.sugerencia_id is not null
           ) order by coalesce(c.orden, 9999)), '[]'::jsonb)
     from public.solicitud_items si
     left join public.catalogo_items c    on c.id = si.item_id
     left join public.sugerencias_item sg on sg.id = si.sugerencia_id
    where si.solicitud_id = s.id) as items,
  -- Los identificadores, aparte del jsonb legible. Son lo que permite
  -- cruzar: el jsonb sirve para mostrar, estos para comparar.
  (select coalesce(array_agg(si.item_id) filter (where si.item_id is not null), '{}')
     from public.solicitud_items si where si.solicitud_id = s.id) as item_ids,
  (select coalesce(array_agg(si.sugerencia_id) filter (where si.sugerencia_id is not null), '{}')
     from public.solicitud_items si where si.solicitud_id = s.id) as sugerencia_ids
from public.solicitudes s
join public.municipios m on m.codigo_dane = s.municipio
where s.estado = 'abierta'
  and s.expira_at > now();

grant select on public.solicitudes_publicas to anon, authenticated;

-- ---------------------------------------------------------------------
-- La consulta del cruce
--
-- Devuelve las solicitudes abiertas que piden alguno de los ítems
-- marcados, primero las que coinciden en más cosas.
--
-- La llama `anon` a propósito: ayudar no debería exigir cuenta. Quien sí
-- la tiene llega con su inventario precargado, pero es un atajo, no un
-- requisito.
--
-- No expone nada que no exponga ya el tablero: lee `solicitudes_publicas`,
-- que es la frontera de seguridad y no incluye `token_hash`.
-- ---------------------------------------------------------------------

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
  v_desde  integer := greatest(coalesce(p_desde, 0), 0);
begin
  -- Guardas de tamaño en un endpoint que llama `anon`. El tope de 12 es el
  -- mismo que el de ítems por solicitud, para que la cabeza no tenga que
  -- sostener dos números distintos.
  if p_item_ids is null or cardinality(p_item_ids) = 0 then
    return;
  end if;
  if cardinality(p_item_ids) > 12 then
    raise exception 'Puedes marcar máximo 12 cosas a la vez';
  end if;

  return query
  select sp.id, sp.codigo, sp.municipio, sp.municipio_nombre, sp.barrio,
         sp.categoria, sp.nota, sp.creada_at, sp.confirmada_at, sp.expira_at,
         sp.horas_sin_confirmar, sp.num_respuestas, sp.items,
         cardinality(array(
           select unnest(sp.item_ids) intersect select unnest(p_item_ids)
         ))::integer as coincidencias
    from public.solicitudes_publicas sp
   where sp.item_ids && p_item_ids
     and (p_municipio is null or sp.municipio = p_municipio)
   order by coincidencias desc, sp.creada_at desc
   limit v_limite offset v_desde;
end;
$$;

grant execute on function public.solicitudes_que_calzan(text[],text,integer,integer)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- Los municipios donde hay algo que calce, para el filtro del segundo modo
-- ---------------------------------------------------------------------

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
      from public.solicitudes_publicas sp
     where p_item_ids is not null
       and cardinality(p_item_ids) between 1 and 12
       and sp.item_ids && p_item_ids
     group by sp.municipio, sp.municipio_nombre
  ) t;
$$;

grant execute on function public.municipios_que_calzan(text[]) to anon, authenticated;

-- Comprobar:
--   select codigo, item_ids from public.solicitudes_publicas;
--   select codigo, coincidencias from public.solicitudes_que_calzan(array['agua','arroz']);
