-- =====================================================================
-- v2 · Fase F — Elección de flujo
--
-- Una solicitud nace `directo` y puede pasar a `acompanado`: una
-- organización aliada coordina la entrega y, para eso, el solicitante
-- entrega nombre, documento y teléfono, que van a `identidades` (Fase E).
--
-- 🔴 Publicar directo sigue siendo el camino por defecto y el más corto
-- (regla R). El acompañamiento se ofrece, se explica y se acepta: no se
-- preselecciona, no se pide dos veces y no se pinta en rojo la opción
-- anónima. Pedir más datos de los necesarios porque la interfaz empujó
-- hacia allá es exactamente el daño que la regla 1 existe para evitar.
--
-- 🔴 Esta es la fase donde empieza la recolección de datos personales de
-- verdad. Antes de desplegarla tienen que estar los papeles de §12:
-- contrato de transmisión de datos con la fundación, registro en el RNBD,
-- canal de habeas data y texto de autorización revisado.
--
-- Idempotente. Se puede volver a correr.
--
-- ---------------------------------------------------------------------
-- Una decisión que se aparta del plan, y por qué
--
-- El plan pedía que `crear_solicitud` ganara `p_flujo`, con el `DROP` y
-- recreación que exige cambiar de firma (§5.3-7). Aquí NO se toca:
--
--   1. `crear_solicitud` es la función de la que depende el Flujo 1
--      entero. Un `DROP` mal hecho la deja con dos sobrecargas y PostgREST
--      responde PGRST203 a cada publicación. Es el cambio más caro de
--      equivocarse en todo el esquema.
--   2. La identidad necesita `solicitud_id`, que no existe hasta que la
--      fila está escrita. Con `p_flujo` en `crear_solicitud` hacen falta
--      dos llamadas igual, y entre una y otra cabe una solicitud marcada
--      como acompañada SIN identidad — un estado que no debería existir.
--
-- En su lugar, `activar_acompanamiento` hace las dos cosas en una sola
-- transacción: crea la identidad y marca la solicitud. Si algo falla, la
-- solicitud se queda `directo`, que es el modo seguro de fallar.
--
-- En la interfaz eso significa que la tarjeta del §7 aparece en el paso de
-- municipio para ANUNCIAR que hay una fundación, y los datos se piden
-- después de publicar, en la pantalla de la solicitud — donde ya está el
-- enlace del §7 para quien se decide más tarde. Quien no complete ese
-- segundo paso queda publicado en Flujo 1, sin haber entregado nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Las columnas nuevas
-- ---------------------------------------------------------------------

alter table public.solicitudes
  add column if not exists flujo text not null default 'directo';

alter table public.solicitudes drop constraint if exists solicitudes_flujo_check;
alter table public.solicitudes add  constraint solicitudes_flujo_check
  check (flujo in ('directo','acompanado'));

-- SET NULL y no CASCADE: si una organización se borra, la solicitud NO se
-- va con ella. Quien pidió ayuda no pierde su solicitud porque la
-- fundación dejó de operar; lo que hay que hacer en ese caso es
-- devolverla a `directo`, y eso lo decide §8-F5, no una llave foránea.
alter table public.solicitudes
  add column if not exists organizacion_id uuid
    references public.organizaciones(id) on delete set null;

-- Coherencia: `directo` no puede tener organización, y `acompanado` no
-- puede quedarse sin ella. Va como CHECK y no como buena costumbre porque
-- las dos rutas que lo escriben son distintas.
alter table public.solicitudes drop constraint if exists solicitudes_flujo_coherente;
alter table public.solicitudes add  constraint solicitudes_flujo_coherente
  check (
    (flujo = 'directo'    and organizacion_id is null)
    or (flujo = 'acompanado' and organizacion_id is not null)
  );

-- Los dos estados nuevos. Todavía no los escribe nadie —los ponen las
-- Fases G y H—, pero entran AHORA, en la misma migración que el predicado
-- que los cubre: introducirlos sin `estado_activo` es lo que hace
-- desaparecer solicitudes del tablero (§5.3-1).
alter table public.solicitudes drop constraint if exists solicitudes_estado_check;
alter table public.solicitudes add  constraint solicitudes_estado_check
  check (estado in ('abierta','en_coordinacion','entregada_parcial','cumplida'));

-- `metricas` es lo que sobrevive al proyecto: si no distingue los dos
-- flujos, la única pregunta interesante que se puede responder después
-- —si acompañar sirvió de algo— queda sin respuesta.
alter table public.metricas
  add column if not exists flujo text not null default 'directo';

comment on column public.solicitudes.flujo is
  'directo = nadie más se mete, el contacto ocurre por fuera (Flujo 1). acompanado = una organización aliada coordina la entrega y existe una fila en identidades colgando de esta solicitud. Solo se pasa de directo a acompanado por activar_acompanamiento; el camino de vuelta es automático y está en §7, nunca un botón.';

-- ---------------------------------------------------------------------
-- 2. El predicado, y los cuatro sitios que lo necesitan
--
-- Sin esto, en cuanto una solicitud entre en coordinación: desaparece del
-- tablero, desaparece del filtro de municipios, nadie más puede ofrecer y
-- —lo peor— no se puede renovar, así que se borra sola a las 72 horas con
-- la coordinación viva dentro (§5.3-1).
--
-- `immutable` para que sirva dentro de un índice si algún día hace falta.
-- ---------------------------------------------------------------------

create or replace function public.estado_activo(p_estado text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_estado in ('abierta','en_coordinacion','entregada_parcial');
$$;

-- ⚠ CON el EXECUTE concedido, y no revocado como el resto de ayudantes.
-- PostgreSQL comprueba los permisos de TABLA con el dueño de la vista,
-- pero los de FUNCION contra quien consulta. Con el revoke puesto,
-- cualquier lectura de solicitudes_publicas moria con «permission denied
-- for function estado_activo» — para todo el mundo, o sea el tablero
-- publico entero. Es la misma trampa que el esquema ya documenta para
-- es_admin() dentro de una politica RLS.
--
-- No filtra nada: recibe un texto y devuelve si esta en una lista de tres.
grant execute on function public.estado_activo(text) to anon, authenticated;

comment on function public.estado_activo(text) is
  'Los estados en los que una solicitud sigue viva y visible. Si algún día se agrega un estado, se agrega AQUÍ y no en cada consulta: los cuatro sitios que filtraban «estado = abierta» a mano son la trampa §5.3-1 del plan.';

-- 2.1 · El tablero público. Gana además `flujo`, para el sello discreto de
-- la tarjeta. Va al final de la lista de columnas porque `create or
-- replace view` no admite insertar una en medio.
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
  (select coalesce(array_agg(si.item_id) filter (where si.item_id is not null), '{}')
     from public.solicitud_items si where si.solicitud_id = s.id) as item_ids,
  (select coalesce(array_agg(si.sugerencia_id) filter (where si.sugerencia_id is not null), '{}')
     from public.solicitud_items si where si.solicitud_id = s.id) as sugerencia_ids,
  -- ⚠ El flujo, y NADA más de la organización ni de la identidad. Esta
  -- vista la lee `anon`: aquí no entra ni el nombre de quien pidió, ni los
  -- cuatro últimos dígitos de su documento, ni el identificador de la
  -- fundación. Solo si esta solicitud tiene acompañamiento o no.
  s.flujo
from public.solicitudes s
join public.municipios m on m.codigo_dane = s.municipio
where public.estado_activo(s.estado)
  and s.expira_at > now();

-- 2.2 · El filtro de municipios del tablero.
create or replace view public.municipios_con_solicitudes as
select distinct m.codigo_dane, m.nombre, m.departamento
from public.municipios m
join public.solicitudes s on s.municipio = m.codigo_dane
where public.estado_activo(s.estado) and s.expira_at > now();

-- 2.3 · Renovar. Era el más grave de los cuatro: sin esto, una solicitud
-- en coordinación no se puede renovar y se borra sola con el hilo vivo.
create or replace function public.renovar_solicitud(p_token text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare v_expira timestamptz;
begin
  update public.solicitudes
     set expira_at = now() + interval '72 hours', confirmada_at = now()
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and public.estado_activo(estado)
  returning expira_at into v_expira;

  if not found then raise exception 'Solicitud no encontrada'; end if;
  return v_expira;
end;
$$;

grant execute on function public.renovar_solicitud(text) to anon, authenticated;

-- 2.4 · Responder. Que la solicitud esté en coordinación no significa que
-- esté resuelta: la entrega puede ser parcial y hacer falta alguien más.
create or replace function public.responder_solicitud(p_codigo text, p_mensaje text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid          uuid := auth.uid();
  v_solicitud_id uuid;
  v_respuesta_id uuid;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if char_length(trim(p_mensaje)) < 10 or char_length(p_mensaje) > 300 then
    raise exception 'El mensaje debe tener entre 10 y 300 caracteres';
  end if;

  if public.contiene_pii(p_mensaje) then
    raise exception 'El mensaje no puede contener teléfonos ni correos: tu contacto ya está en tu perfil';
  end if;

  if not exists (select 1 from public.perfiles p
                  where p.id = v_uid and p.suspendido = false) then
    raise exception 'Necesitas completar tu perfil antes de responder';
  end if;

  select s.id into v_solicitud_id
    from public.solicitudes s
   where s.codigo = upper(trim(p_codigo))
     and public.estado_activo(s.estado)
     and s.expira_at > now();

  if v_solicitud_id is null then
    raise exception 'Esa solicitud ya no está disponible';
  end if;

  if exists (select 1 from public.respuestas r
              where r.solicitud_id = v_solicitud_id and r.autor_id = v_uid) then
    raise exception 'Ya respondiste esta solicitud';
  end if;

  insert into public.respuestas (solicitud_id, autor_id, mensaje)
  values (v_solicitud_id, v_uid, trim(p_mensaje))
  returning id into v_respuesta_id;

  return v_respuesta_id;
end;
$$;

revoke execute on function public.responder_solicitud(text,text) from public, anon;
grant  execute on function public.responder_solicitud(text,text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Las métricas dicen de qué flujo venían
-- ---------------------------------------------------------------------

create or replace function public.cerrar_solicitud(p_token text, p_cumplida boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_sol public.solicitudes;
begin
  select * into v_sol from public.solicitudes
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if not found then raise exception 'Solicitud no encontrada'; end if;

  insert into public.metricas (
    municipio, categoria, cumplida, horas_hasta_respuesta,
    horas_hasta_cierre, num_respuestas, es_prueba, flujo)
  select v_sol.municipio, v_sol.categoria, p_cumplida,
         extract(epoch from (min(r.creada_at) - v_sol.creada_at)) / 3600,
         extract(epoch from (now() - v_sol.creada_at)) / 3600,
         count(r.id), v_sol.es_prueba, v_sol.flujo
    from public.respuestas r where r.solicitud_id = v_sol.id;

  delete from public.solicitudes where id = v_sol.id;   -- CASCADE limpia todo
end;
$$;

grant execute on function public.cerrar_solicitud(text, boolean) to anon, authenticated;

-- Lo mismo en el job. ⚠ Esta función sigue teniendo los dos defectos de
-- §5.7-3 —borra sin mirar el estado, y registra `cumplida = false` para
-- todas—, y eso lo arregla la Fase I. Aquí solo se le agrega el flujo,
-- para que las métricas no nazcan mintiendo mientras tanto.
create or replace function public.expirar_solicitudes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_n integer;
begin
  insert into public.metricas (
    municipio, categoria, cumplida, horas_hasta_respuesta,
    horas_hasta_cierre, num_respuestas, es_prueba, flujo)
  select s.municipio, s.categoria, false,
         extract(epoch from (min(r.creada_at) - s.creada_at)) / 3600,
         extract(epoch from (s.expira_at - s.creada_at)) / 3600,
         count(r.id), s.es_prueba, s.flujo
    from public.solicitudes s
    left join public.respuestas r on r.solicitud_id = s.id
   where s.expira_at <= now()
   group by s.id, s.municipio, s.categoria, s.creada_at, s.expira_at, s.es_prueba, s.flujo;

  delete from public.solicitudes where expira_at <= now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke execute on function public.expirar_solicitudes() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. ¿Hay una fundación en este municipio?
--
-- Lo mínimo para poder ofrecer el acompañamiento sin revelar nada: el
-- nombre y el identificador de UNA organización activa que cubra ese
-- municipio. Ni cuántas hay, ni dónde queda su acopio, ni cuánta gente
-- tiene dentro.
--
-- Devuelve una sola —la más antigua— a propósito: la tarjeta del §7 dice
-- «hay una fundación que puede acompañarte», con nombre. Un desplegable
-- de fundaciones convertiría una oferta en una decisión de compras, y
-- quien está publicando una solicitud a las tres de la mañana no está
-- para elegir proveedor.
-- ---------------------------------------------------------------------

create or replace function public.aliado_en_municipio(p_municipio text)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select jsonb_build_object('id', o.id, 'nombre', o.nombre)
    from public.organizaciones o
   where o.activa
     and p_municipio = any(o.municipios)
   order by o.creada_at
   limit 1;
$$;

grant execute on function public.aliado_en_municipio(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Activar el acompañamiento
--
-- Una sola transacción: crea la identidad cifrada y marca la solicitud.
-- Si el cifrado falla —por ejemplo porque falta el secreto del Vault—, no
-- queda una solicitud acompañada sin identidad: no queda nada.
--
-- La autoriza el token portador, que es lo único que tiene quien pidió
-- ayuda. No hay sesión que consultar y no debe haberla.
--
-- NO existe el camino de vuelta. Quien se arrepienta borra y republica,
-- que además es su derecho de supresión (§7).
-- ---------------------------------------------------------------------

create or replace function public.activar_acompanamiento(
  p_token                text,
  p_organizacion_id      uuid,
  p_nombre               text,
  p_documento_tipo       text,
  p_documento            text,
  p_autorizacion_version text,
  p_telefono             text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sol public.solicitudes;
  v_org public.organizaciones;
begin
  select * into v_sol from public.solicitudes s
   where s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and public.estado_activo(s.estado)
     and s.expira_at > now();

  if v_sol.id is null then
    raise exception 'Solicitud no encontrada o vencida';
  end if;

  if v_sol.flujo = 'acompanado' then
    raise exception 'Esta solicitud ya tiene acompañamiento';
  end if;

  select * into v_org from public.organizaciones o
   where o.id = p_organizacion_id and o.activa;

  if v_org.id is null then
    raise exception 'Esa organización no está disponible';
  end if;

  -- Que la fundación trabaje donde está la solicitud. Sin esto, quien
  -- conozca un identificador de organización podría colgarle solicitudes
  -- de cualquier parte del país.
  if not (v_sol.municipio = any(v_org.municipios)) then
    raise exception 'Esa organización no trabaja en el municipio de esta solicitud';
  end if;

  -- Primero la identidad: si algo de esto falla, la solicitud no llega a
  -- marcarse y se queda como estaba.
  perform public.crear_identidad(
    'solicitante', p_nombre, p_documento_tipo, p_documento,
    p_autorizacion_version, p_telefono, v_sol.id, null);

  update public.solicitudes
     set flujo = 'acompanado', organizacion_id = v_org.id
   where id = v_sol.id;

  return jsonb_build_object(
    'codigo',       v_sol.codigo,
    'organizacion', v_org.nombre
  );
end;
$$;

grant execute on function public.activar_acompanamiento(text,uuid,text,text,text,text,text)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. `leer_solicitud` cuenta en qué flujo está
--
-- Sin esto, la pantalla de quien pidió ayuda no puede saber si ofrecerle
-- el acompañamiento o decirle que ya lo tiene. Devuelve el NOMBRE de la
-- organización, nunca su identificador ni nada de la identidad: los datos
-- que entregó no se le vuelven a mostrar, porque mostrarlos no le sirve de
-- nada y multiplica los sitios por donde pueden salir.
-- ---------------------------------------------------------------------

create or replace function public.leer_solicitud(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sol  public.solicitudes;
  v_resp jsonb;
  v_items jsonb;
begin
  select * into v_sol from public.solicitudes
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  if not found then
    raise exception 'Solicitud no encontrada o vencida';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'mensaje', r.mensaje, 'creada_at', r.creada_at,
           'nombre', p.nombre_visible, 'contacto', p.contacto_publico,
           'contacto_tipo', p.contacto_tipo, 'tipo', p.tipo,
           'profesion', sv.profesion, 'verificado', coalesce(sv.verificado, false)
         ) order by r.creada_at desc), '[]'::jsonb)
    into v_resp
    from public.respuestas r
    join public.perfiles p on p.id = r.autor_id
    left join public.servidores sv on sv.perfil_id = p.id
   where r.solicitud_id = v_sol.id and p.suspendido = false;

  -- Mismo left join con coalesce triple que `solicitudes_publicas`: sin él,
  -- el ítem sugerido no aparecería aquí, ni siquiera para quien lo pidió.
  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre',        coalesce(c.nombre, sg.nombre_propuesto),
           'cantidad',      si.cantidad,
           'unidad',        coalesce(c.unidad, sg.unidad_sugerida, 'unidad'),
           'cubierto',      si.cubierto,
           'por_confirmar', si.sugerencia_id is not null
         ) order by coalesce(c.orden, 9999)), '[]'::jsonb)
    into v_items
    from public.solicitud_items si
    left join public.catalogo_items c    on c.id = si.item_id
    left join public.sugerencias_item sg on sg.id = si.sugerencia_id
   where si.solicitud_id = v_sol.id;

  return jsonb_build_object(
    'id', v_sol.id, 'codigo', v_sol.codigo, 'municipio', v_sol.municipio,
    'barrio', v_sol.barrio, 'categoria', v_sol.categoria, 'nota', v_sol.nota,
    'estado', v_sol.estado, 'expira_at', v_sol.expira_at,
    'flujo', v_sol.flujo,
    'organizacion', (select o.nombre from public.organizaciones o
                      where o.id = v_sol.organizacion_id),
    'items', v_items, 'respuestas', v_resp
  );
end;
$$;

grant execute on function public.leer_solicitud(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Y ahora sí, el aliado puede leer la identidad que le toca
--
-- Esto es lo que la Fase E dejó explícitamente pendiente: hasta que
-- existió `solicitudes.organizacion_id` no había forma de saber a QUÉ
-- organización pertenece una identidad, y conceder por «es aliado con
-- permiso en alguna organización» habría dejado que cualquier fundación
-- leyera las cédulas de las demás.
--
-- Cuatro condiciones, todas: miembro activo, con `puede_ver_identidad`,
-- de la organización que acompaña ESA solicitud, y con la organización
-- activa. Las identidades que cuelgan de un perfil —las de ofertadores y
-- aliados— siguen siendo solo del administrador: quién puede verlas
-- depende de la conversación en la que aparezcan, y eso llega con la
-- Fase G.
-- ---------------------------------------------------------------------

create or replace function public.puede_leer_identidad(p_identidad_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    (public.es_admin(auth.uid())
       and exists (select 1 from public.identidades i where i.id = p_identidad_id))
    or exists (
      select 1
        from public.identidades i
        join public.solicitudes s          on s.id = i.solicitud_id
        join public.miembros_organizacion m on m.organizacion_id = s.organizacion_id
        join public.organizaciones o        on o.id = m.organizacion_id
       where i.id = p_identidad_id
         and s.flujo             = 'acompanado'
         and m.perfil_id         = auth.uid()
         and m.estado            = 'activo'
         and m.puede_ver_identidad
         and o.activa);
$$;

revoke execute on function public.puede_leer_identidad(uuid) from public, anon, authenticated;

-- Comprobar:
--   -- El tablero sigue mostrando lo de siempre y ahora dice el flujo:
--   select codigo, flujo from public.solicitudes_publicas order by creada_at desc limit 5;
--
--   -- Los cuatro sitios ya no filtran 'abierta' a mano:
--   select count(*) from pg_get_viewdef('public.solicitudes_publicas'::regclass) v
--    where v like '%estado_activo%';                                          -- 1
--
--   -- Nada de la identidad se cuela en lo público:
--   select count(*) from information_schema.columns
--    where table_name = 'solicitudes_publicas'
--      and column_name in ('organizacion_id','documento_ultimos4','nombre');  -- 0
--
--   -- Y el aliado sin permiso sigue sin poder leer nada, contra una
--   -- solicitud de PRUEBA acompañada.
