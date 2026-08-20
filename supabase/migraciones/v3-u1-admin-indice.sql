-- =====================================================================
-- v3 · Fase U · 1 — el índice de administración y el contexto del reporte
--
-- Dos funciones nuevas. Ninguna existente cambia de firma.
--
-- 1 · `panel_admin_indice()` — todos los contadores de `/admin` en una
--     sola consulta. Antes cada pestaña traía lo suyo y el número solo se
--     sabía después de entrar; ahora el índice los enseña todos de una
--     vez, y encadenar diez consultas para dibujar diez filas sería peor
--     que las pestañas que reemplaza.
--
-- 2 · `reportes_con_contenido()` — la cola de reportes CON lo reportado.
--
--     ⚠ Este es el arreglo que importa. Hoy la tarjeta de un reporte
--     muestra el motivo, el tipo de objeto y su uuid, y nada más: quien
--     modera decide entre «descartar» y «borrar para siempre» sin haber
--     visto nunca el contenido. Borrar a ciegas es firmar a ciegas.
--
--     Va por RPC y no por `select` desde el cliente porque los objetos
--     viven en seis tablas distintas, varias con el GRANT revocado, y
--     porque hay que poder decir «esto ya no existe» sin que eso sea una
--     consulta más. La función ES la frontera: devuelve el texto que se
--     reportó y nada de alrededor —ni token, ni contacto del solicitante,
--     ni el uuid de quien escribió—.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Los contadores del índice
--
-- El orden de las claves es el de la pantalla: primero lo que espera a
-- una persona, después el contenido que se cura, y al final las
-- organizaciones. Las filas del primer grupo son las que se pintan en
-- terracota, y su suma es el número del encabezado.
-- ---------------------------------------------------------------------

create or replace function public.panel_admin_indice()
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
    -- Esperando a alguien
    'matriculas', (
      select count(*) from public.servidores where not verificado),
    'telefonos', (
      select count(*) from public.proveedores
       where not telefono_verificado and not suspendido),
    'hilos_sin_fundacion', (
      select count(*) from public.conversaciones where estado = 'esperando_aliado'),
    'reportes', (
      select count(*) from public.reportes where not atendido),

    -- Contenido
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
$$;

revoke execute on function public.panel_admin_indice() from public, anon;
grant  execute on function public.panel_admin_indice() to authenticated;

-- ---------------------------------------------------------------------
-- 2 · La cola de reportes, con lo reportado dentro
--
-- `contenido` es el texto que se denunció; `contexto` es lo mínimo para
-- ubicarlo —el código de la solicitud, el nombre del proveedor—; `existe`
-- dice si el objeto sigue ahí. Cuando ya no está, la interfaz solo ofrece
-- descartar: no hay nada que borrar.
--
-- Lo que NO sale de aquí, y es a propósito: `solicitudes.token_hash`,
-- `contacto_solicitante`, el `perfil_id` de quien escribió una respuesta y
-- el `autor` de una reseña. Se modera un texto, no una persona; suspender
-- una cuenta es otra acción y tiene su propia pantalla.
-- ---------------------------------------------------------------------

create or replace function public.reportes_con_contenido()
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

  return coalesce((
    select jsonb_agg(x order by x->>'creado_at' desc)
    from (
      select jsonb_build_object(
        'id',          r.id,
        'motivo',      r.motivo,
        'tipo_objeto', r.tipo_objeto,
        'objeto_id',   r.objeto_id,
        'nota',        r.nota,
        'creado_at',   r.creado_at,

        'existe', case r.tipo_objeto
          when 'solicitud' then exists (select 1 from public.solicitudes t where t.id = r.objeto_id)
          when 'respuesta' then exists (select 1 from public.respuestas t where t.id = r.objeto_id)
          when 'perfil'    then exists (select 1 from public.perfiles t where t.id = r.objeto_id)
          when 'entidad'   then exists (select 1 from public.entidades t where t.id = r.objeto_id)
          when 'proveedor' then exists (select 1 from public.proveedores t where t.id = r.objeto_id)
          when 'resena'    then exists (select 1 from public.resenas t where t.id = r.objeto_id)
          else false end,

        -- El texto reportado. Puede ser nulo: una solicitud sin nota o un
        -- perfil sin descripción existen y son moderables igual.
        'contenido', case r.tipo_objeto
          when 'solicitud' then (select t.nota from public.solicitudes t where t.id = r.objeto_id)
          when 'respuesta' then (select t.mensaje from public.respuestas t where t.id = r.objeto_id)
          when 'perfil'    then (select t.descripcion from public.perfiles t where t.id = r.objeto_id)
          when 'entidad'   then (select t.descripcion from public.entidades t where t.id = r.objeto_id)
          when 'proveedor' then (select t.descripcion from public.proveedores t where t.id = r.objeto_id)
          when 'resena'    then (select t.comentario from public.resenas t where t.id = r.objeto_id)
          else null end,

        -- El nombre visible de lo reportado, cuando lo tiene. En una
        -- solicitud no hay ninguno, y esa es justo la gracia.
        'titulo', case r.tipo_objeto
          when 'perfil'    then (select t.nombre_visible from public.perfiles t where t.id = r.objeto_id)
          when 'entidad'   then (select t.nombre from public.entidades t where t.id = r.objeto_id)
          when 'proveedor' then (select t.nombre_visible from public.proveedores t where t.id = r.objeto_id)
          when 'resena'    then (select p.nombre_visible
                                   from public.resenas t
                                   join public.proveedores p on p.id = t.proveedor_id
                                  where t.id = r.objeto_id)
          else null end,

        -- Dónde vive: el código de la solicitud y su municipio, para poder
        -- ir a mirarla. Sin barrio en la respuesta: ubicar la denuncia no
        -- necesita bajar a ese detalle.
        'contexto', case r.tipo_objeto
          when 'solicitud' then (
            select jsonb_build_object('codigo', t.codigo, 'lugar', m.nombre || ' · ' || t.barrio)
              from public.solicitudes t
              join public.municipios m on m.codigo_dane = t.municipio
             where t.id = r.objeto_id)
          when 'respuesta' then (
            select jsonb_build_object('codigo', s.codigo, 'lugar', m.nombre)
              from public.respuestas t
              join public.solicitudes s on s.id = t.solicitud_id
              join public.municipios m on m.codigo_dane = s.municipio
             where t.id = r.objeto_id)
          else null end,

        -- Los ítems de una solicitud reportada: los datos personales se
        -- cuelan tanto en la nota como en un ítem sugerido.
        'items', case r.tipo_objeto
          when 'solicitud' then (
            select coalesce(jsonb_agg(coalesce(c.nombre, sg.nombre_propuesto)
                                      order by coalesce(c.orden, 9999)), '[]'::jsonb)
              from public.solicitud_items si
              left join public.catalogo_items c    on c.id = si.item_id
              left join public.sugerencias_item sg on sg.id = si.sugerencia_id
             where si.solicitud_id = r.objeto_id)
          else null end
      ) as x
      from public.reportes r
      where not r.atendido
      order by r.creado_at desc
      limit 100
    ) s
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.reportes_con_contenido() from public, anon;
grant  execute on function public.reportes_con_contenido() to authenticated;

-- Comprobar:
--   select public.panel_admin_indice();
--   select jsonb_pretty(public.reportes_con_contenido());

-- ---------------------------------------------------------------------
-- 3 · La bitácora, unificada
--
-- Hasta ahora vivía escondida detrás de un botón en dos pantallas
-- distintas: las identidades dentro de Aliados y las referencias dentro de
-- Servicios. Un registro de accesos que nadie mira no disuade a nadie, así
-- que pasa a fila propia del índice y las dos tablas se leen juntas.
--
-- Dice quién leyó, cuándo y con qué motivo. NUNCA qué leyó: aquí no hay ni
-- un nombre, ni un documento, ni un teléfono, y por eso puede vivir en una
-- pantalla. `lector` va recortado a ocho caracteres, que es lo que hace
-- falta para reconocer a la misma persona entre dos filas.
--
-- ⚠ No distingue las planillas de las identidades, y no puede: los dos
-- caminos escriben en `accesos_identidad` a través de
-- `registrar_acceso_identidad`, que no recibe un tipo. Separarlas exige
-- una columna nueva en una tabla que nadie puede modificar y un parámetro
-- más en esa función.
-- ---------------------------------------------------------------------

create or replace function public.bitacora_accesos()
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

  return coalesce((
    select jsonb_agg(x order by x->>'cuando' desc)
    from (
      (select jsonb_build_object(
        'tipo',   'identidad',
        'rol',    a.rol_lector,
        'lector', left(a.lector_ref, 8),
        'organizacion', (
          select o.nombre
            from public.miembros_organizacion mo
            join public.organizaciones o on o.id = mo.organizacion_id
           where mo.perfil_id = a.leida_por
           limit 1),
        'motivo', a.motivo,
        'cuando', a.leida_at,
        'huerfano', a.identidad_id is null
      ) as x
      from public.accesos_identidad a
      order by a.leida_at desc
      limit 100)

      union all

      (select jsonb_build_object(
        'tipo',   'referencia',
        'rol',    a.rol_lector,
        'lector', left(a.lector_ref, 8),
        'organizacion', (
          select o.nombre
            from public.miembros_organizacion mo
            join public.organizaciones o on o.id = mo.organizacion_id
           where mo.perfil_id = a.leida_por
           limit 1),
        'motivo', a.motivo,
        'cuando', a.leida_at,
        'huerfano', a.referencia_id is null
      ) as x
      from public.accesos_referencia a
      order by a.leida_at desc
      limit 100)
    ) s
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.bitacora_accesos() from public, anon;
grant  execute on function public.bitacora_accesos() to authenticated;

-- Comprobar:
--   select jsonb_pretty(public.bitacora_accesos());
