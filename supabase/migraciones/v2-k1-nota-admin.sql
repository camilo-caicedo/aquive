-- =====================================================================
-- v2 · El administrador puede decir «esto ya se entregó»
--
-- Faltaba un caso real: quien opera la plataforma se entera por fuera de
-- que una solicitud ya se resolvió —una llamada, un mensaje, alguien que
-- lo cuenta— y no tenía forma de decirlo. La solicitud seguía en el
-- tablero, y tres personas más se movilizaban por lo mismo.
--
-- Dos cosas, y una no va sin la otra: una nota pública y un cierre.
--
-- ⚠ CERRAR NO ES BORRAR, y es la decisión de fondo. `cerrar_solicitud`
-- borra, pero esa la llama quien pidió, con su token, sobre lo suyo. Aquí
-- se cierra la solicitud de OTRA persona: se marca `cumplida` —que la saca
-- del tablero, porque `estado_activo()` no la incluye— y ahí termina. Quien
-- pidió conserva su enlace, sus respuestas y su plazo, y la solicitud se
-- borra sola a las 72 horas como todas. Cerrar lo de alguien no debería
-- quitarle nada.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La nota, con su rastro
-- ---------------------------------------------------------------------

alter table public.solicitudes
  add column if not exists nota_admin     text check (char_length(nota_admin) <= 200),
  add column if not exists nota_admin_at  timestamptz,
  add column if not exists nota_admin_por uuid references auth.users(id) on delete set null;

comment on column public.solicitudes.nota_admin is
  'Nota PÚBLICA del administrador sobre esta solicitud, del estilo «esto ya se entregó». Lleva filtro de PII, a diferencia de `entidades.pie`: aquel describe una organización, este habla de la entrega a una persona y la tentación de escribir un nombre o una dirección es real.';

-- ---------------------------------------------------------------------
-- 2. Anotar, y de paso cerrar si hay certeza
--
-- Una sola RPC para las dos cosas porque casi siempre van juntas: se
-- cierra PORQUE se sabe algo, y ese algo es lo que hay que escribir.
-- ---------------------------------------------------------------------

create or replace function public.admin_anotar_solicitud(
  p_codigo text,
  p_nota   text,
  p_cerrar boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_nota text := nullif(trim(coalesce(p_nota, '')), '');
  v_sol  public.solicitudes;
begin
  if not public.es_admin(v_uid) then
    raise exception 'No autorizado';
  end if;

  if v_nota is not null then
    if char_length(v_nota) > 200 then
      raise exception 'La nota no puede pasar de 200 caracteres';
    end if;
    -- Mismo filtro que la nota de quien pide. Aquí escribe el responsable
    -- del proyecto, sí, pero sobre la entrega a una persona concreta: es
    -- justo donde uno escribiría «se lo llevaron a María, calle 5».
    if public.contiene_pii(v_nota) then
      raise exception 'La nota no puede llevar teléfonos, correos ni documentos. Di qué pasó, no de quién.';
    end if;
  end if;

  if p_cerrar and v_nota is null then
    raise exception 'Para cerrar una solicitud ajena hay que decir por qué';
  end if;

  select * into v_sol from public.solicitudes s
   where s.codigo = upper(trim(p_codigo));

  if v_sol.id is null then
    raise exception 'Esa solicitud no existe o ya se borró';
  end if;

  update public.solicitudes
     set nota_admin     = v_nota,
         nota_admin_at  = case when v_nota is null then null else now() end,
         nota_admin_por = case when v_nota is null then null else v_uid end,
         -- `cumplida` y nunca un borrado: ver la cabecera.
         estado         = case when p_cerrar then 'cumplida' else estado end
   where id = v_sol.id;

  return jsonb_build_object(
    'codigo', v_sol.codigo,
    'cerrada', p_cerrar
  );
end;
$$;

revoke execute on function public.admin_anotar_solicitud(text,text,boolean) from public, anon;
grant  execute on function public.admin_anotar_solicitud(text,text,boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Que la nota se vea en el tablero
--
-- Va al final de la vista: `create or replace view` no deja meter una
-- columna en medio, solo añadirla.
-- ---------------------------------------------------------------------

create or replace view public.solicitudes_publicas as
SELECT s.id,
    s.codigo,
    s.municipio,
    m.nombre AS municipio_nombre,
    s.barrio,
    s.categoria,
    s.nota,
    s.creada_at,
    s.confirmada_at,
    s.expira_at,
    EXTRACT(epoch FROM now() - s.confirmada_at) / 3600::numeric AS horas_sin_confirmar,
    ( SELECT count(*) AS count
           FROM respuestas r
          WHERE r.solicitud_id = s.id) AS num_respuestas,
    ( SELECT COALESCE(jsonb_agg(jsonb_build_object('nombre', COALESCE(c.nombre, sg.nombre_propuesto), 'cantidad', si.cantidad, 'unidad', COALESCE(c.unidad, sg.unidad_sugerida, 'unidad'::text), 'por_confirmar', si.sugerencia_id IS NOT NULL) ORDER BY (COALESCE(c.orden, 9999))), '[]'::jsonb) AS "coalesce"
           FROM solicitud_items si
             LEFT JOIN catalogo_items c ON c.id = si.item_id
             LEFT JOIN sugerencias_item sg ON sg.id = si.sugerencia_id
          WHERE si.solicitud_id = s.id) AS items,
    ( SELECT COALESCE(array_agg(si.item_id) FILTER (WHERE si.item_id IS NOT NULL), '{}'::text[]) AS "coalesce"
           FROM solicitud_items si
          WHERE si.solicitud_id = s.id) AS item_ids,
    ( SELECT COALESCE(array_agg(si.sugerencia_id) FILTER (WHERE si.sugerencia_id IS NOT NULL), '{}'::uuid[]) AS "coalesce"
           FROM solicitud_items si
          WHERE si.solicitud_id = s.id) AS sugerencia_ids,
    s.flujo,
    -- Texto del proyecto, no de quien pidió. Se escribe para ser leído aquí.
    s.nota_admin
   FROM solicitudes s
     JOIN municipios m ON m.codigo_dane = s.municipio
  WHERE estado_activo(s.estado) AND s.expira_at > now();

grant select on public.solicitudes_publicas to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Lo que ve el panel
--
-- Las activas y también las que el administrador acaba de cerrar, que
-- desaparecen del tablero público pero tienen que seguir viéndose desde
-- aquí mientras existan — si no, cerrar una sería perderla de vista sin
-- saber si funcionó.
-- ---------------------------------------------------------------------

create or replace function public.solicitudes_admin()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select case when not public.es_admin(auth.uid()) then '[]'::jsonb
         else coalesce((
           select jsonb_agg(jsonb_build_object(
             'codigo',      s.codigo,
             'municipio',   m.nombre,
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
$$;

revoke execute on function public.solicitudes_admin() from public, anon;
grant  execute on function public.solicitudes_admin() to authenticated;

-- Comprobar:
--   select public.solicitudes_admin();
--   -- Con una cuenta que no sea admin tiene que devolver [].
