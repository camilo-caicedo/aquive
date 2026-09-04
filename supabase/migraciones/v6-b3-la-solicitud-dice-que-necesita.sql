-- =====================================================================
-- v6 · Fase B · 3 — la solicitud de servicio dice qué necesita
--
-- ADR 0011. El primer paso de «pedir un servicio» pintaba los cuarenta y
-- tantos oficios del catálogo y no dejaba continuar sin marcar uno. El
-- rebusque es justo el trabajo que no está en ninguna lista: quien
-- necesita que le arreglen la puerta del clóset recorría las píldoras, no
-- encontraba la suya y se iba.
--
-- Pasa a ser una de las ocho categorías —los gajos de la sombrilla, que
-- ya son el lenguaje de toda la aplicación— más una línea escrita.
--
-- `catalogo_oficios` no se toca: sigue siendo lo que un prestador marca
-- en su ficha y lo que gobierna la regla 7. Lo que deja de hacer es
-- amarrar lo que OTRA persona puede pedir.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Las columnas
--
-- `oficio_id` se queda anulable en vez de borrarse: las solicitudes que
-- ya existen conservan su enlace y no se pierde nada. Deja de escribirse.
-- ---------------------------------------------------------------------

alter table public.solicitudes_servicio
  add column if not exists grupo text,
  add column if not exists detalle text,
  -- Nulo = nadie la ha mirado. Es la cola de /admin.
  add column if not exists revisada_at timestamptz;

alter table public.solicitudes_servicio alter column oficio_id drop not null;

-- Las que ya hay se rellenan con lo que su oficio decía, que es
-- exactamente la información que tenían.
update public.solicitudes_servicio s
   set grupo   = coalesce(s.grupo, o.grupo),
       detalle = coalesce(s.detalle, o.nombre)
  from public.catalogo_oficios o
 where o.id = s.oficio_id
   and (s.grupo is null or s.detalle is null);

-- Cinturón para una fila sin oficio y sin grupo, que no debería existir.
update public.solicitudes_servicio
   set grupo = coalesce(grupo, 'otros'),
       detalle = coalesce(detalle, 'Sin detalle')
 where grupo is null or detalle is null;

alter table public.solicitudes_servicio
  alter column grupo set not null,
  alter column detalle set not null;

-- Los ocho grupos son gemelos de `GRUPOS` en `src/lib/servicios.ts` y de
-- `NOMBRE_GRUPO` en el contrato. La base manda: ella rechaza.
alter table public.solicitudes_servicio
  drop constraint if exists solicitudes_servicio_grupo_check;
alter table public.solicitudes_servicio
  add constraint solicitudes_servicio_grupo_check
  check (grupo = any (array['comida','belleza','confeccion','transporte',
                            'aseo','cuidado','reparacion','otros']));

-- 80, como el tope que valida el dominio. Tres de mínimo: «sí» no es una
-- solicitud.
alter table public.solicitudes_servicio
  drop constraint if exists solicitudes_servicio_detalle_check;
alter table public.solicitudes_servicio
  add constraint solicitudes_servicio_detalle_check
  check (char_length(btrim(detalle)) between 3 and 80);

-- El índice del tablero filtraba por oficio y ahora filtra por grupo.
drop index if exists public.idx_solicitudes_servicio_vigentes;
create index if not exists idx_solicitudes_servicio_vigentes
  on public.solicitudes_servicio (municipio, grupo)
  where estado = 'abierta';

-- La cola de moderación: solo lo que nadie ha mirado, lo más viejo primero.
create index if not exists idx_solicitudes_servicio_sin_revisar
  on public.solicitudes_servicio (creada_at)
  where revisada_at is null;

-- ---------------------------------------------------------------------
-- 2 · La vista pública
--
-- ⚠ El join a `catalogo_oficios` era INNER. Con `oficio_id` en nulo, la
-- solicitud desaparecía del tablero sin decir nada: se publicaba bien y no
-- salía en ninguna parte. Ahora el grupo y el texto salen de la propia
-- fila y no hay join que pueda tragarse una solicitud.
--
-- `oficio_id` deja de exponerse: nadie lo lee ya, y una columna anulable
-- en una vista pública es una invitación a filtrar por algo que la mitad
-- de las filas no tiene.
-- ---------------------------------------------------------------------

drop view if exists public.solicitudes_servicio_publicas cascade;

create view public.solicitudes_servicio_publicas as
select
  s.id,
  s.codigo,
  s.grupo,
  s.detalle,
  s.municipio,
  s.zona_id,
  z.nombre as zona_nombre,
  s.zona_texto,
  s.urgencia,
  s.capacidad_pago,
  s.nota,
  s.creada_at,
  s.expira_at,
  (select count(*) from public.respuestas_servicio rs where rs.solicitud_id = s.id)
    as num_respuestas
from public.solicitudes_servicio s
left join public.zonas z on z.id = s.zona_id
where s.estado = 'abierta'
  and s.expira_at > now();

grant select on public.solicitudes_servicio_publicas to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3 · El tablero
--
-- Cambia el nombre de un parámetro, así que hay que borrarla y crearla:
-- `create or replace` no puede renombrarlos.
-- ---------------------------------------------------------------------

drop function if exists public.solicitudes_de_servicio(text, text, text);

create function public.solicitudes_de_servicio(
  p_municipio text default null,
  p_grupo text default null,
  p_token text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_prov uuid := public.proveedor_del_llamante(p_token);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'codigo', s.codigo,
      'grupo', s.grupo,
      'detalle', s.detalle,
      'municipio', s.municipio,
      'zona_nombre', s.zona_nombre,
      'zona_texto', s.zona_texto,
      'urgencia', s.urgencia,
      'capacidad_pago', s.capacidad_pago,
      'nota', s.nota,
      'creada_at', s.creada_at,
      'num_respuestas', s.num_respuestas,
      'ya_respondi', v_prov is not null and exists (
        select 1 from public.respuestas_servicio r
         where r.solicitud_id = s.id and r.proveedor_id = v_prov),
      -- De aquí cuelga el hilo. Nulo mientras no haya respondido.
      'mi_respuesta_id', (
        select r.id from public.respuestas_servicio r
         where r.solicitud_id = s.id and r.proveedor_id = v_prov)
    ) order by
        case s.urgencia when 'hoy' then 0 when 'esta_semana' then 1 else 2 end,
        s.creada_at desc)
    from public.solicitudes_servicio_publicas s
    where (p_municipio is null or s.municipio = p_municipio)
      and (p_grupo is null or s.grupo = p_grupo)
  ), '[]'::jsonb);
end;
$function$;

grant execute on function public.solicitudes_de_servicio(text, text, text)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4 · La cola de /admin
--
-- Se añade aquí y no en `v6-b1`, que es donde se arregló el índice: una
-- función que cuenta una columna que todavía no existe es el mismo error
-- que se acababa de arreglar.
-- ---------------------------------------------------------------------

create or replace function public.panel_admin_indice()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  return jsonb_build_object(
    -- Esperando a alguien. La suma de este grupo es el número del escudo.
    'matriculas', (
      select count(*) from public.servidores where not verificado),
    'telefonos', (
      select count(*) from public.proveedores
       where not telefono_verificado and not suspendido),
    'reportes', (
      select count(*) from public.reportes where not atendido),

    -- Contenido
    'solicitudes_servicio_sin_revisar', (
      select count(*) from public.solicitudes_servicio
       where revisada_at is null and estado = 'abierta' and expira_at > now()),
    'sugerencias', (
      select count(*) from public.sugerencias_item where estado = 'pendiente'),
    'items_activos', (
      select count(*) from public.catalogo_items where activo),
    'entidades', (select count(*) from public.entidades),
    'entidades_retiradas', (select count(*) from public.entidades where not activa),
    'solicitudes_abiertas', (
      select count(*) from public.solicitudes s
       where public.estado_activo(s.estado) and s.expira_at > now()),
    'solicitudes_sin_respuestas', (
      select count(*) from public.solicitudes s
       where public.estado_activo(s.estado) and s.expira_at > now()
         and not exists (select 1 from public.respuestas r where r.solicitud_id = s.id)),
    'resenas_ocultas', (select count(*) from public.resenas where oculta),
    'zonas_pendientes', (select count(*) from public.zonas where estado = 'propuesta'),
    'fichas_suspendidas', (select count(*) from public.proveedores where suspendido),

    -- Organizaciones
    'organizaciones', (select count(*) from public.organizaciones),
    'organizaciones_inactivas', (select count(*) from public.organizaciones where not activa)
  );
end;
$function$;

revoke execute on function public.panel_admin_indice() from public, anon;
grant  execute on function public.panel_admin_indice() to authenticated;

-- ---------------------------------------------------------------------
-- 5 · Marcar una solicitud como revisada, o borrarla
-- ---------------------------------------------------------------------

create or replace function public.revisar_solicitud_servicio(
  p_id uuid,
  p_borrar boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  if p_borrar then
    -- Borrar es DELETE (regla 3). Arrastra respuestas y sus hilos.
    delete from public.solicitudes_servicio where id = p_id;
  else
    update public.solicitudes_servicio
       set revisada_at = now()
     where id = p_id;
  end if;
end;
$function$;

revoke execute on function public.revisar_solicitud_servicio(uuid, boolean) from public, anon;
grant  execute on function public.revisar_solicitud_servicio(uuid, boolean) to authenticated;

-- Comprobar:
--   select grupo, detalle, revisada_at from public.solicitudes_servicio limit 5;
--   select public.solicitudes_de_servicio(null, 'reparacion', null);
