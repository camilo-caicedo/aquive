-- =====================================================================
-- v3 · Fase S7 — Moderación y métricas del módulo de Servicios
--
-- Lo que faltaba para que el módulo se pueda sostener: que un reporte
-- sobre una ficha o una calificación tenga qué hacer al resolverse, que
-- el administrador tenga una pantalla con las tres colas, y que lo que
-- sobrevive al borrado se publique como dato abierto.
--
-- El §9 del documento fuente admite que la moderación no está resuelta.
-- Esto no la resuelve —eso es una persona, no una migración— pero al
-- menos deja de ser imposible.
--
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. `resolver_reporte` para los dos objetos nuevos
--
-- Se redefine entera porque plpgsql no admite parches: esta versión es la
-- de `v2-i1-ciclo-de-vida.sql` con dos ramas más al final. Si alguna vez
-- cambia la rama de `solicitud`, hay que cambiarla aquí también — es el
-- costo de tener una sola función para todos los tipos, y sigue siendo
-- más barato que tener cinco funciones que se desincronizan.
--
-- Las dos ramas nuevas hacen cosas distintas a propósito:
--   · Una ficha se SUSPENDE, no se borra. Es el sustento de alguien; si
--     el reporte resulta infundado, se levanta sin que haya perdido sus
--     calificaciones ni su historial.
--   · Una calificación se BORRA de verdad. Cuando un reporte por
--     extorsión o discriminación se confirma, dejarla oculta sería dejar
--     el arma cargada en la mesa. El servicio confirmado se queda:
--     ocurrió, y eso no lo cambia que la opinión sobrara.
-- ---------------------------------------------------------------------

create or replace function public.resolver_reporte(p_reporte_id uuid, p_borrar boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rep public.reportes;
  v_sol public.solicitudes;
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  select * into v_rep from public.reportes where id = p_reporte_id;
  if not found then raise exception 'Reporte no encontrado'; end if;

  if p_borrar then
    if v_rep.tipo_objeto = 'solicitud' then
      select * into v_sol from public.solicitudes where id = v_rep.objeto_id;

      if v_sol.id is not null then
        -- Cerrar los hilos antes de borrar: los participantes ven que se
        -- cerró, no un hueco donde había una conversación.
        update public.conversaciones
           set estado = 'cerrada', cerrada_at = now()
         where solicitud_id = v_sol.id and estado <> 'cerrada';

        -- Y dejar la métrica, que si no se pierde: es la única huella de
        -- que esa solicitud existió.
        insert into public.metricas (
          municipio, categoria, cumplida, horas_hasta_respuesta,
          horas_hasta_cierre, num_respuestas, es_prueba, flujo, con_aliado)
        select v_sol.municipio, v_sol.categoria, false,
               extract(epoch from (min(r.creada_at) - v_sol.creada_at)) / 3600,
               extract(epoch from (now() - v_sol.creada_at)) / 3600,
               count(r.id), v_sol.es_prueba, v_sol.flujo,
               exists (select 1 from public.conversaciones c
                        where c.solicitud_id = v_sol.id and c.aliado_id is not null)
          from public.respuestas r where r.solicitud_id = v_sol.id;

        delete from public.solicitudes where id = v_sol.id;
      end if;

    elsif v_rep.tipo_objeto = 'respuesta' then
      delete from public.respuestas where id = v_rep.objeto_id;
    elsif v_rep.tipo_objeto = 'perfil' then
      update public.perfiles set suspendido = true where id = v_rep.objeto_id;
    elsif v_rep.tipo_objeto = 'entidad' then
      -- Se retira, no se borra: si el enlace se recupera, se vuelve a subir
      -- sin tener que escribir la ficha entera otra vez.
      update public.entidades set activa = false, actualizada_at = now()
       where id = v_rep.objeto_id;

    elsif v_rep.tipo_objeto = 'proveedor' then
      update public.proveedores set suspendido = true, actualizado_at = now()
       where id = v_rep.objeto_id;
    elsif v_rep.tipo_objeto = 'resena' then
      delete from public.resenas where id = v_rep.objeto_id;
    end if;
  end if;

  update public.reportes set atendido = true where id = p_reporte_id;
end;
$$;

revoke execute on function public.resolver_reporte(uuid,boolean) from public, anon;
grant  execute on function public.resolver_reporte(uuid,boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 2. El panel del administrador, en una llamada
--
-- Trae las tres colas y lo reportado. Sin PII de referencias: de ellas
-- solo el conteo y el estado, como en la cola del aliado.
-- ---------------------------------------------------------------------

create or replace function public.panel_admin_servicios()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  return jsonb_build_object(
    -- Los que esperan una llamada. Primero los que tienen algún oficio
    -- de riesgo escondido: ahí la verificación no es cosmética, es lo
    -- que decide si esa persona existe en el directorio.
    'por_verificar', coalesce((
      select jsonb_agg(x order by (x->>'oficios_esperando')::int desc,
                                  x->>'creado_at')
      from (
        select jsonb_build_object(
          'id', p.id,
          'nombre_visible', p.nombre_visible,
          'telefono', p.telefono,
          'municipio', p.municipio,
          'creado_at', p.creado_at,
          'organizacion', o.nombre,
          'oficios_esperando', (
            select count(*)
            from public.proveedor_oficios po
            join public.catalogo_oficios c on c.id = po.oficio_id
            where po.proveedor_id = p.id and c.riesgo = 'alto')
        ) as x
        from public.proveedores p
        left join public.organizaciones o on o.id = p.organizacion_id
        where not p.telefono_verificado and not p.suspendido
      ) s), '[]'::jsonb),

    'suspendidos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'nombre_visible', p.nombre_visible,
        'municipio', p.municipio,
        'actualizado_at', p.actualizado_at
      ) order by p.actualizado_at desc)
      from public.proveedores p where p.suspendido), '[]'::jsonb),

    'resenas_ocultas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'proveedor_id', r.proveedor_id,
        'proveedor_nombre', p.nombre_visible,
        'comentario', r.comentario,
        'replica', r.replica,
        'creada_at', r.creada_at
      ) order by r.creada_at desc)
      from public.resenas r
      join public.proveedores p on p.id = r.proveedor_id
      where r.oculta), '[]'::jsonb),

    'referencias_pendientes', (
      select count(*) from public.referencias r where r.estado = 'pendiente'),

    'totales', jsonb_build_object(
      'proveedores', (select count(*) from public.proveedores),
      'publicados', (select count(*) from public.proveedores_publicos),
      'solicitudes', (select count(*) from public.solicitudes_servicio),
      'servicios_confirmados', (
        select count(*) from public.servicios_prestados
         where confirmado_at is not null))
  );
end;
$$;

revoke execute on function public.panel_admin_servicios() from public, anon;
grant  execute on function public.panel_admin_servicios() to authenticated;

-- ---------------------------------------------------------------------
-- 3. Sembrar una zona
--
-- Solo Cali viene sembrada. Cuando otra ciudad tenga suficientes
-- proveedores como para que el filtro sirva, un administrador siembra sus
-- comunas desde el panel en vez de pedir una migración.
-- ---------------------------------------------------------------------

create or replace function public.guardar_zona(
  p_municipio text,
  p_nombre    text,
  p_tipo      text,
  p_orden     integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text := trim(coalesce(p_nombre, ''));
  v_id     uuid;
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;
  if char_length(v_nombre) < 2 or char_length(v_nombre) > 60 then
    raise exception 'El nombre debe tener entre 2 y 60 caracteres';
  end if;
  if p_tipo not in ('comuna','corregimiento','barrio') then
    raise exception 'Tipo de zona inválido';
  end if;
  if not exists (select 1 from public.municipios m where m.codigo_dane = p_municipio) then
    raise exception 'Municipio inválido';
  end if;

  insert into public.zonas (municipio, nombre, tipo, orden)
  values (p_municipio, v_nombre, p_tipo, coalesce(p_orden, 0))
  on conflict (municipio, nombre) do update set
    tipo = excluded.tipo, orden = excluded.orden, activa = true
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.guardar_zona(text,text,text,integer) from public, anon;
grant  execute on function public.guardar_zona(text,text,text,integer) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Activar y desactivar un oficio
--
-- Desactivar, no borrar: un oficio con fichas colgando no se puede
-- borrar —hay llaves foráneas— y tampoco se querría, porque se llevaría
-- por delante lo que esa gente ofrece. Desactivado deja de ofrecerse a
-- quien se registra y desaparece de las vistas públicas.
--
-- El `riesgo` también se puede mover desde aquí, y por eso el comentario
-- de la tabla dice lo que dice: bajarlo de `alto` a `bajo` publica de
-- golpe los oficios de cuidado de todo el mundo sin verificar.
-- ---------------------------------------------------------------------

create or replace function public.guardar_oficio(
  p_id     text,
  p_grupo  text,
  p_nombre text,
  p_riesgo text,
  p_activo boolean default true,
  p_orden  integer default 0
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;
  if p_id !~ '^[a-z0-9_]{3,40}$' then
    raise exception 'El id lleva solo minúsculas, números y guion bajo';
  end if;
  if p_grupo not in ('comida','belleza','confeccion','transporte','aseo',
                     'cuidado','reparacion','otros') then
    raise exception 'Grupo inválido';
  end if;
  if p_riesgo not in ('bajo','alto') then
    raise exception 'Riesgo inválido';
  end if;
  if char_length(trim(coalesce(p_nombre, ''))) between 2 and 60 then
    null;
  else
    raise exception 'El nombre debe tener entre 2 y 60 caracteres';
  end if;

  insert into public.catalogo_oficios (id, grupo, nombre, riesgo, activo, orden)
  values (p_id, p_grupo, trim(p_nombre), p_riesgo, coalesce(p_activo, true),
          coalesce(p_orden, 0))
  on conflict (id) do update set
    grupo = excluded.grupo,
    nombre = excluded.nombre,
    riesgo = excluded.riesgo,
    activo = excluded.activo,
    orden = excluded.orden;
end;
$$;

revoke execute on function public.guardar_oficio(text,text,text,text,boolean,integer)
  from public, anon;
grant execute on function public.guardar_oficio(text,text,text,text,boolean,integer)
  to authenticated;

-- ---------------------------------------------------------------------
-- 5. Los datos abiertos del módulo
--
-- `metricas_servicio` ya tiene lectura pública por RLS, pero en crudo son
-- miles de filas. Esto es lo que se publica en /datos: agregado por
-- oficio y por municipio, sin nada que identifique a nadie — nunca lo
-- tuvo, porque la tabla no guarda ni la zona.
-- ---------------------------------------------------------------------

create or replace view public.datos_servicios as
select m.municipio,
       m.grupo,
       m.oficio,
       count(*)                                   as solicitudes,
       count(*) filter (where m.hubo_respuesta)   as con_respuesta,
       count(*) filter (where m.hubo_confirmacion) as resueltas,
       round(avg(m.horas_hasta_respuesta), 1)     as horas_promedio
from public.metricas_servicio m
where not m.es_prueba
group by m.municipio, m.grupo, m.oficio;

grant select on public.datos_servicios to anon, authenticated;

comment on view public.datos_servicios is
  'Dato abierto del módulo de Servicios. Sin texto, sin zona, sin identificadores: la tabla de origen tampoco los tiene.';
