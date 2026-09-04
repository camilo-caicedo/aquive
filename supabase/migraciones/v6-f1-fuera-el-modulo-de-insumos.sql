-- =====================================================================
-- v6 · Fase F · 1 — se retira el módulo de insumos (ADR 0014)
--
-- Al decidirlo, en producción había 0 solicitudes, 0 respuestas y 0
-- ofrecimientos. Nunca se usó. En pruebas hay 2 solicitudes y 20
-- ofrecimientos, todos de semilla o del responsable.
--
-- ⚠ EL ORDEN DE ESTE ARCHIVO NO ES NEGOCIABLE.
--
-- Lo primero que se hace es REESCRIBIR las funciones que sobreviven y que
-- leen las tablas que van a morir. `mis_avisos` es `language sql` con
-- cuerpo de cadena, así que Postgres NO registra la dependencia: el `drop
-- table` va a tener éxito y la función queda rota en silencio hasta que
-- alguien abra sus avisos. Es literalmente lo que documenta
-- `v6-b4-vuelve-el-proveedor-del-llamante.sql` que ya pasó una vez, con
-- once funciones a la vez.
--
-- ⚠ LO QUE NO SE TOCA, y parece de aquí:
--
--   `catalogo_items`     `entregas.item_id` es llave foránea contra ella.
--   `sugerencias_item`   `entregas.sugerencia_id` también, y su
--                        `tipo = 'oficio'` es del ADR 0013.
--   `entregas`           Es de acopios (ADR 0008). Guarda
--                        `solicitud_codigo` como TEXTO y sin llave
--                        foránea, justo para sobrevivir a esto.
--   `push_ofertadores`   El nombre engaña: es la ÚNICA tabla de
--                        suscripciones push de toda la aplicación. Se
--                        RENOMBRA a `push_avisos`.
--   `metricas_servicio`  Es del directorio de oficios, no de insumos.
--   `expirar_servicios`  Es el vencimiento de 15 días de servicios.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1 · Las funciones que sobreviven, PRIMERO
-- ---------------------------------------------------------------------

-- 1.1 · `mis_avisos` pierde su primer brazo.
--
-- Eran dos: quien respondió a una solicitud mía de insumos y quien
-- respondió a un pedido de servicio mío. Queda el segundo.
create or replace function public.mis_avisos()
returns jsonb
language sql
stable security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by (x->>'fecha') desc), '[]'::jsonb)
    from (
      -- Quien respondió a un pedido de servicio mío.
      select jsonb_build_object(
               'tipo',  'respuesta',
               'texto', 'Alguien respondió a ' || ss.codigo,
               'fecha', rs.creada_at,
               'href',  '/mis-solicitudes'
             ) as x
        from public.respuestas_servicio rs
        join public.solicitudes_servicio ss on ss.id = rs.solicitud_id
       where ss.perfil_id = auth.uid()
    ) t;
$$;

-- 1.2 · El índice de `/admin` pierde los dos contadores de insumos.
create or replace function public.panel_admin_indice()
returns jsonb
language plpgsql
stable security definer
set search_path = ''
as $$
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
    'imagenes', (
      select count(*) from public.imagenes where estado = 'en_cola'),
    'pqr', (
      select count(*) from public.pqr where estado = 'abierta'),

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
    'resenas_ocultas', (select count(*) from public.resenas where oculta),
    'zonas_pendientes', (select count(*) from public.zonas where estado = 'propuesta'),
    'fichas_suspendidas', (select count(*) from public.proveedores where suspendido),

    -- Organizaciones
    'organizaciones', (select count(*) from public.organizaciones),
    'organizaciones_inactivas', (select count(*) from public.organizaciones where not activa)
  );
end;
$$;

-- 1.3 · La cola de reportes deja de saber de solicitudes y respuestas.
--
-- Quedan los cuatro objetos que sobreviven: perfil, entidad, proveedor y
-- reseña. Con ellos se van `contexto` e `items`, que solo existían para
-- las solicitudes de insumos.
create or replace function public.reportes_con_contenido()
returns jsonb
language plpgsql
stable security definer
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
          when 'perfil'    then exists (select 1 from public.perfiles t where t.id = r.objeto_id)
          when 'entidad'   then exists (select 1 from public.entidades t where t.id = r.objeto_id)
          when 'proveedor' then exists (select 1 from public.proveedores t where t.id = r.objeto_id)
          when 'resena'    then exists (select 1 from public.resenas t where t.id = r.objeto_id)
          else false end,

        'contenido', case r.tipo_objeto
          when 'perfil'    then (select t.descripcion from public.perfiles t where t.id = r.objeto_id)
          when 'entidad'   then (select t.descripcion from public.entidades t where t.id = r.objeto_id)
          when 'proveedor' then (select t.descripcion from public.proveedores t where t.id = r.objeto_id)
          when 'resena'    then (select t.comentario from public.resenas t where t.id = r.objeto_id)
          else null end,

        'titulo', case r.tipo_objeto
          when 'perfil'    then (select t.nombre_visible from public.perfiles t where t.id = r.objeto_id)
          when 'entidad'   then (select t.nombre from public.entidades t where t.id = r.objeto_id)
          when 'proveedor' then (select t.nombre_visible from public.proveedores t where t.id = r.objeto_id)
          when 'resena'    then (select p.nombre_visible
                                   from public.resenas t
                                   join public.proveedores p on p.id = t.proveedor_id
                                  where t.id = r.objeto_id)
          else null end,

        -- `contexto` e `items` eran de la solicitud de insumos y ya no
        -- tienen de dónde salir. Se quedan en nulo y no se quitan del
        -- objeto: la pantalla ya sabe leerlos así.
        'contexto', null,
        'items',    null
      ) as x
      from public.reportes r
      where not r.atendido
      order by r.creado_at desc
      limit 100
    ) s
  ), '[]'::jsonb);
end;
$$;

-- 1.4 · Resolver un reporte, sin las dos ramas de insumos.
create or replace function public.resolver_reporte(p_reporte_id uuid, p_borrar boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rep public.reportes;
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  select * into v_rep from public.reportes where id = p_reporte_id;
  if not found then raise exception 'Reporte no encontrado'; end if;

  if p_borrar then
    if v_rep.tipo_objeto = 'perfil' then
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

-- 1.5 · Los usos de una sugerencia de ítem ya no cuentan insumos.
--
-- Un ítem del catálogo sigue vivo: es el vocabulario con el que un centro
-- de acopio registra lo que entra y lo que sale (ADR 0008). Lo que ya no
-- existe es `solicitud_items` ni `ofrecimientos`, así que sus usos salen
-- de `entregas`.
create or replace function public.sugerencias_pendientes()
returns jsonb
language plpgsql
stable security definer
set search_path = ''
as $$
declare v_out jsonb;
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id',                 sg.id,
           'tipo',               sg.tipo,
           'nombre_propuesto',   sg.nombre_propuesto,
           'categoria_sugerida', sg.categoria_sugerida,
           'grupo_sugerido',     sg.grupo_sugerido,
           'origen',             sg.origen,
           'creada_at',          sg.creada_at,
           -- Cuántas cosas la usan hoy. Es lo que hace decidir: una que
           -- nadie usa se puede rechazar sin romperle nada a nadie.
           'usos', case sg.tipo
             when 'oficio' then
               (select count(*) from public.solicitudes_servicio ss
                 where ss.sugerencia_id = sg.id)
             + (select count(*) from public.proveedor_oficios_sugeridos pos
                 where pos.sugerencia_id = sg.id)
             else
               (select count(*) from public.entregas e
                 where e.sugerencia_id = sg.id)
           end,
           'parecidos', case sg.tipo
             when 'oficio' then (
               select coalesce(jsonb_agg(jsonb_build_object(
                        'id', c.id, 'nombre', c.nombre, 'categoria', c.grupo)), '[]'::jsonb)
                 from public.catalogo_oficios c
                where c.activo
                  and exists (
                    select 1 from unnest(string_to_array(
                             lower(translate(sg.nombre_propuesto, 'áéíóúü', 'aeiouu')), ' ')) w
                     where char_length(w) >= 4
                       and lower(translate(c.nombre, 'áéíóúü', 'aeiouu')) like '%' || w || '%'))
             else (
               select coalesce(jsonb_agg(jsonb_build_object(
                        'id', c.id, 'nombre', c.nombre, 'categoria', c.categoria)), '[]'::jsonb)
                 from public.catalogo_items c
                where c.activo
                  and exists (
                    select 1 from unnest(string_to_array(
                             lower(translate(sg.nombre_propuesto, 'áéíóúü', 'aeiouu')), ' ')) w
                     where char_length(w) >= 4
                       and lower(translate(c.nombre, 'áéíóúü', 'aeiouu')) like '%' || w || '%'))
           end
         ) order by sg.creada_at), '[]'::jsonb)
    into v_out
    from public.sugerencias_item sg
   where sg.estado = 'pendiente';

  return v_out;
end;
$$;

-- 1.6 · Resolver una sugerencia: la rama de ítem pierde el remapeo.
--
-- ⚠ Al aprobar o fusionar un ítem ya no hay `ofrecimientos` ni
-- `solicitud_items` que remapear. Lo que queda es crear —o encontrar— la
-- fila del catálogo y marcar la sugerencia. La rama de OFICIO no cambia.
create or replace function public.resolver_sugerencia(
  p_sugerencia_id uuid,
  p_accion        text,
  p_item_destino  text default null,
  p_nota          text default null,
  p_nombre_final  text default null,
  p_grupo         text default null,
  p_riesgo        text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_sug     public.sugerencias_item;
  v_destino text;
  v_estado  text;
  v_nombre  text;
begin
  if not public.es_admin(v_uid) then
    raise exception 'No autorizado';
  end if;

  if p_accion not in ('aprobar','rechazar','fusionar') then
    raise exception 'Acción inválida';
  end if;

  select * into v_sug from public.sugerencias_item where id = p_sugerencia_id;
  if not found then raise exception 'Sugerencia no encontrada'; end if;
  if v_sug.estado <> 'pendiente' then
    raise exception 'Esa sugerencia ya fue resuelta';
  end if;

  -- El administrador puede corregir el texto antes de aprobarlo: casi
  -- siempre es una tilde o un plural, y obligar a rechazar y esperar a
  -- que la persona lo vuelva a escribir es perder la propuesta.
  v_nombre := coalesce(nullif(btrim(p_nombre_final), ''), btrim(v_sug.nombre_propuesto));

  -- =================================================================
  -- Rechazar: igual para los dos tipos
  -- =================================================================
  if p_accion = 'rechazar' then
    update public.sugerencias_item
       set estado = 'rechazada', revisada_por = v_uid, revisada_at = now(),
           nota_revision = nullif(trim(p_nota), '')
     where id = p_sugerencia_id;

    -- El oficio propuesto de una ficha, que nunca llegó a publicarse.
    -- (El `delete from ofrecimientos` que había aquí se fue con la tabla.)
    delete from public.proveedor_oficios_sugeridos where sugerencia_id = p_sugerencia_id;
    return null;
  end if;

  -- El mismo guardia de siempre, y vale para los dos catálogos: los dos
  -- son de lectura pública y permanente, y no hay RPC para borrar de
  -- ninguno. Un clic distraído publicaría ese teléfono para siempre.
  if public.contiene_pii(v_nombre) then
    raise exception 'Esa sugerencia trae un teléfono o un correo: recházala, no la apruebes';
  end if;

  -- =================================================================
  -- Oficio (ADR 0013). Sin cambios.
  -- =================================================================
  if v_sug.tipo = 'oficio' then
    if p_accion = 'aprobar' then
      if p_riesgo is null or p_riesgo not in ('bajo','alto') then
        raise exception 'Elige el riesgo del oficio: es lo que decide si se publica sin verificar';
      end if;

      v_destino := public.slug_oficio(v_nombre);
      insert into public.catalogo_oficios (id, grupo, nombre, riesgo, activo, orden)
      values (v_destino,
              coalesce(nullif(btrim(p_grupo), ''), v_sug.grupo_sugerido),
              v_nombre,
              p_riesgo,
              true,
              9999);
      v_estado := 'aprobada';
    else
      v_destino := p_item_destino;
      if v_destino is null then
        raise exception 'Indica con qué oficio se fusiona';
      end if;
      if not exists (select 1 from public.catalogo_oficios c where c.id = v_destino) then
        raise exception 'Ese oficio no existe en el catálogo';
      end if;
      v_estado := 'fusionada';
    end if;

    -- La solicitud pasa a apuntar al oficio de verdad. Su `detalle` se
    -- queda como estaba: es contexto de quien pidió, no el nombre.
    update public.solicitudes_servicio
       set oficio_id = v_destino, sugerencia_id = null
     where sugerencia_id = p_sugerencia_id;

    -- Y el oficio propuesto entra en la ficha, con el precio que su dueño
    -- ya había puesto. `on conflict do nothing` porque puede que entre
    -- tanto haya elegido a mano el oficio destino de una fusión: ahí gana
    -- lo que ya está publicado.
    insert into public.proveedor_oficios (proveedor_id, oficio_id, modo, precio_desde, unidad)
    select pos.proveedor_id, v_destino, pos.modo, pos.precio_desde, pos.unidad
      from public.proveedor_oficios_sugeridos pos
     where pos.sugerencia_id = p_sugerencia_id
    on conflict (proveedor_id, oficio_id) do nothing;

    delete from public.proveedor_oficios_sugeridos where sugerencia_id = p_sugerencia_id;

    update public.sugerencias_item
       set estado = v_estado, oficio_resultante_id = v_destino,
           revisada_por = v_uid, revisada_at = now(),
           nota_revision = nullif(trim(p_nota), '')
     where id = p_sugerencia_id;

    return v_destino;
  end if;

  -- =================================================================
  -- Ítem del catálogo de acopio
  --
  -- ⚠ Aquí vivía el remapeo de `ofrecimientos` y `solicitud_items`, con
  -- sus dos trampas escritas —el índice único de uno y la falta de índice
  -- del otro—. Las dos tablas se fueron con el módulo de insumos (ADR
  -- 0014), así que ya no hay nada que remapear: un ítem nuevo entra en el
  -- catálogo y la sugerencia queda marcada.
  -- =================================================================
  if p_accion = 'aprobar' then
    v_destino := public.slug_item(v_nombre);
    insert into public.catalogo_items (id, categoria, nombre, unidad, orden, creado_por, origen, es_prueba)
    values (v_destino,
            coalesce(v_sug.categoria_sugerida, 'otros'),
            v_nombre,
            coalesce(nullif(trim(v_sug.unidad_sugerida), ''), 'unidad'),
            9999, v_uid, 'sugerencia', v_sug.es_prueba);
    v_estado := 'aprobada';
  else
    v_destino := p_item_destino;
    if v_destino is null then
      raise exception 'Indica con qué ítem se fusiona';
    end if;
    if not exists (select 1 from public.catalogo_items c where c.id = v_destino) then
      raise exception 'Ese ítem no existe en el catálogo';
    end if;
    v_estado := 'fusionada';
  end if;

  update public.sugerencias_item
     set estado = v_estado, item_resultante_id = v_destino,
         revisada_por = v_uid, revisada_at = now(),
         nota_revision = nullif(trim(p_nota), '')
   where id = p_sugerencia_id;

  return v_destino;
end;
$$;


-- ---------------------------------------------------------------------
-- 2 · El chat pasa de cinco orígenes a cuatro (ADR 0009, corregido)
--
-- ⚠ La columna y su CHECK van en el MISMO archivo y en este orden. Un
-- `drop column` deja el CHECK apuntando a una columna que no existe, y
-- entonces la tabla no acepta ni un insert.
-- ---------------------------------------------------------------------
alter table public.chats drop constraint if exists chats_un_origen;
alter table public.chats drop column if exists respuesta_insumo_id;
alter table public.chats add constraint chats_un_origen
  check (num_nonnulls(respuesta_servicio_id, producto_id, publicacion_id, proveedor_id) = 1);


-- ---------------------------------------------------------------------
-- 3 · Los reportes ya no aceptan objetos que no existen
-- ---------------------------------------------------------------------
delete from public.reportes where tipo_objeto in ('solicitud','respuesta');

alter table public.reportes drop constraint if exists reportes_tipo_objeto_check;
alter table public.reportes add constraint reportes_tipo_objeto_check
  check (tipo_objeto = any (array['perfil','entidad','proveedor','resena']));


-- ---------------------------------------------------------------------
-- 4 · Las funciones que se van
-- ---------------------------------------------------------------------
drop function if exists public.guardar_ofrecimientos(jsonb);
drop function if exists public.mis_ofrecimientos();
drop function if exists public.mis_respuestas();
drop function if exists public.responder_solicitud(text, text, boolean);
drop function if exists public.solicitudes_admin();
drop function if exists public.solicitudes_que_calzan(text[], text, integer, integer);
drop function if exists public.municipios_que_calzan(text[]);
drop function if exists public.destinatarios_aviso(text, text[]);
drop function if exists public.admin_anotar_solicitud(text, text, boolean);
drop function if exists public.movilidad_solicitud(text);
drop function if exists public.expirar_solicitudes();
-- Su único disparador colgaba de `solicitud_items` y de `ofrecimientos`,
-- y las dos se van abajo. Sin ellas es una función que nadie llama.
drop function if exists public.limpiar_sugerencia_huerfana() cascade;


-- ---------------------------------------------------------------------
-- 5 · Las vistas
-- ---------------------------------------------------------------------
drop view if exists public.v_cruces;
drop view if exists public.ofertadores_publicos;
drop view if exists public.municipios_con_ofertadores;
drop view if exists public.municipios_con_solicitudes;
drop view if exists public.solicitudes_publicas;


-- ---------------------------------------------------------------------
-- 6 · Las tablas
--
-- `cascade` porque entre ellas hay llaves foráneas y RLS colgando, y
-- porque los hilos de chat que apuntaban a una respuesta de insumos ya
-- perdieron su columna arriba.
-- ---------------------------------------------------------------------
drop table if exists public.respuestas cascade;
drop table if exists public.solicitud_items cascade;
drop table if exists public.ofrecimientos cascade;
drop table if exists public.solicitudes cascade;
drop table if exists public.metricas cascade;

-- La que sí llevaba meses muerta: la llenaba un componente sin
-- importadores, y el envío de verdad lee la otra.
drop table if exists public.push_suscripciones cascade;


-- ---------------------------------------------------------------------
-- 7 · La tabla de push se llama por lo que hace
--
-- ⚠ NO es de insumos, aunque lo diga el nombre. Es la única tabla de
-- suscripciones push de toda la aplicación: la llena `/perfil/avisos` y
-- la lee el chat.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_class where relname = 'push_ofertadores' and relnamespace = 'public'::regnamespace) then
    alter table public.push_ofertadores rename to push_avisos;
  end if;
end $$;

drop function if exists public.guardar_push_ofertador(text, text, text);
drop function if exists public.quitar_push_ofertador(text);
drop function if exists public.quitar_push_ofertador();

-- Las dos de siempre, con el nombre nuevo y el mismo cuerpo. El único
-- cambio real es que ahora se llaman por lo que hacen.
create or replace function public.guardar_push(
  p_endpoint text, p_p256dh text, p_auth text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Debes iniciar sesión'; end if;
  if not exists (select 1 from public.perfiles p where p.id = v_uid) then
    raise exception 'Primero completa tu cuenta: tu nombre y tu municipio';
  end if;

  insert into public.push_avisos (perfil_id, endpoint, p256dh, auth_key)
  values (v_uid, p_endpoint, p_p256dh, p_auth)
  on conflict (perfil_id, endpoint) do nothing;
end;
$$;

create or replace function public.quitar_push(p_endpoint text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Debes iniciar sesión'; end if;

  if p_endpoint is null then
    delete from public.push_avisos where perfil_id = v_uid;
  else
    delete from public.push_avisos where perfil_id = v_uid and endpoint = p_endpoint;
  end if;
end;
$$;

revoke execute on function public.guardar_push(text, text, text) from public, anon;
grant  execute on function public.guardar_push(text, text, text) to authenticated;
revoke execute on function public.quitar_push(text) from public, anon;
grant  execute on function public.quitar_push(text) to authenticated;


-- ---------------------------------------------------------------------
-- 8 · El vencimiento de 72 horas deja de programarse
--
-- Queda uno solo: `expirar-servicios`, el de 15 días.
-- ---------------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'expirar-solicitudes') then
    perform cron.unschedule('expirar-solicitudes');
  end if;
exception when undefined_table or invalid_schema_name then
  -- Sin `pg_cron` en esta base no hay nada que desprogramar.
  null;
end $$;


-- =====================================================================
-- Comprobar:
--
--   -- Ninguna función puede seguir nombrando lo que ya no existe.
--   select p.proname
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and (p.prosrc like '%public.ofrecimientos%'
--        or p.prosrc like '%solicitud_items%'
--        or p.prosrc like '%from public.solicitudes %'
--        or p.prosrc like '%public.respuestas %'
--        or p.prosrc like '%push_ofertadores%');
--   -- Esperado: 0 filas.
--
--   -- El chat, con cuatro orígenes.
--   select pg_get_constraintdef(oid) from pg_constraint
--    where conname = 'chats_un_origen';
--
--   -- Y un solo vencimiento programado.
--   select jobname from cron.job order by 1;
-- =====================================================================
