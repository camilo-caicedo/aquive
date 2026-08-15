-- =====================================================================
-- v2 · La campana deja de ser un interruptor y pasa a ser avisos
--
-- Hasta ahora, para saber si alguien respondió había que entrar a la
-- solicitud, o al panel, y mirar en detalle. No había ningún sitio que
-- dijera «esto pasó desde la última vez que miraste».
--
-- Cinco cosas le pueden pasar a una cuenta, y las cinco se derivan de
-- datos que ya existen. NO hace falta una tabla de notificaciones con
-- estado leído/no leído: con saber hasta cuándo miró cada quien, el resto
-- es una consulta.
--
-- (En el chat no hay menciones que avisar: la regla M bloquea arrobas y
-- teléfonos, así que no hay a quién mencionar.)
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Las dos columnas que faltaban
-- ---------------------------------------------------------------------

-- Hasta cuándo miré. Es lo único que hace falta para saber qué es nuevo.
alter table public.perfiles
  add column if not exists avisos_vistos_at timestamptz;

comment on column public.perfiles.avisos_vistos_at is
  'Hasta cuándo miró esta persona sus avisos. Sustituye a una tabla de notificaciones con estado leído/no leído: con esta marca, lo nuevo es todo lo posterior.';

-- Cuándo se activó el acompañamiento. Sin esto, el aviso de «la solicitud
-- que respondiste ahora tiene fundación» no tiene fecha, y sin fecha no se
-- puede saber si es nuevo.
alter table public.solicitudes
  add column if not exists acompanamiento_at timestamptz;

-- Las que ya estaban acompañadas antes de esta migración se quedan con la
-- fecha de creación de su identidad, que es el momento real en que pasó.
update public.solicitudes s
   set acompanamiento_at = coalesce(
         (select i.creada_at from public.identidades i where i.solicitud_id = s.id),
         s.creada_at)
 where s.flujo = 'acompanado' and s.acompanamiento_at is null;

-- ---------------------------------------------------------------------
-- 2. `activar_acompanamiento` deja la marca de tiempo
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
     set flujo = 'acompanado',
         organizacion_id = v_org.id,
         acompanamiento_at = now()
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
-- 3. Los avisos
--
-- Cinco orígenes en una sola lista, ordenada por fecha. Cada fila lleva a
-- dónde va, para que el panel sea un menú de enlaces y no un resumen que
-- obliga a buscar.
--
-- Tope de 30: quien tenga más de treinta avisos sin mirar no necesita el
-- treinta y uno, necesita abrir la aplicación.
-- ---------------------------------------------------------------------

create or replace function public.mis_avisos()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by (x->>'fecha') desc), '[]'::jsonb)
    from (
      select x from (
        -- 1 · El último mensaje de cada hilo mío, si lo escribió otra
        --     persona. Uno por hilo, no uno por mensaje: veinte mensajes
        --     de la misma conversación son una novedad, no veinte.
        select jsonb_build_object(
                 'tipo',   'mensaje',
                 'texto',  case u.autor_rol
                             when 'solicitante' then 'Quien pidió ayuda escribió en '
                             when 'aliado'      then 'La fundación escribió en '
                             when 'admin'       then 'Moderación escribió en '
                             else 'Quien ofrece escribió en '
                           end || u.codigo,
                 'fecha',  u.creado_at,
                 'href',   '/aliado'
               ) as x, u.creado_at as fecha
          from (
            select distinct on (c.id)
                   m.autor_rol, m.autor_perfil_id, m.creado_at, s.codigo
              from public.mensajes m
              join public.conversaciones c on c.id = m.conversacion_id
              join public.solicitudes s    on s.id = c.solicitud_id
             where m.oculto = false
               and (c.ofertador_id = auth.uid()
                    or public.es_miembro_activo(c.organizacion_id, auth.uid()))
               -- El primer mensaje de un aliado en MI hilo es la
               -- invitación, y esa ya sale abajo con su propio nombre.
               and not (c.ofertador_id = auth.uid()
                        and m.autor_rol = 'aliado'
                        and m.creado_at = (select min(m2.creado_at)
                                             from public.mensajes m2
                                            where m2.conversacion_id = c.id))
             order by c.id, m.creado_at desc
          ) u
         -- Fuera del DISTINCT ON, no dentro: si el último mensaje lo
         -- escribí yo no hay novedad, y tampoco la hay en el penúltimo,
         -- que ya había leído cuando contesté.
         -- (`is distinct from` y no `<>`: el solicitante no tiene cuenta y
         -- su `autor_perfil_id` es nulo.)
         where u.autor_perfil_id is distinct from auth.uid()

        union all

        -- 2 · Me invitaron a coordinar: el hilo lo abrió un aliado.
        select jsonb_build_object(
                 'tipo',  'invitacion',
                 'texto', 'Te invitaron a coordinar la entrega de ' || s.codigo,
                 'fecha', c.creada_at,
                 'href',  '/aliado'
               ), c.creada_at
          from public.conversaciones c
          join public.solicitudes s on s.id = c.solicitud_id
         where c.ofertador_id = auth.uid()
           and (select m.autor_rol from public.mensajes m
                 where m.conversacion_id = c.id
                 order by m.creado_at limit 1) = 'aliado'

        union all

        -- 3 · Hilos de mi organización que nadie ha atendido.
        select jsonb_build_object(
                 'tipo',  'sin_atender',
                 'texto', 'Nadie se ha hecho cargo de la conversación de ' || s.codigo,
                 'fecha', c.creada_at,
                 'href',  '/aliado'
               ), c.creada_at
          from public.conversaciones c
          join public.solicitudes s on s.id = c.solicitud_id
         where c.aliado_id is null
           and c.estado in ('esperando_aliado','asignada')
           and public.es_miembro_activo(c.organizacion_id, auth.uid())

        union all

        -- 4 · Una solicitud que respondí pasó a tener acompañamiento, y
        --     todavía no hay conversación conmigo.
        select jsonb_build_object(
                 'tipo',  'acompanamiento',
                 'texto', 'Ahora una fundación acompaña ' || s.codigo || ', donde ofreciste ayuda',
                 'fecha', s.acompanamiento_at,
                 'href',  '/responder/' || s.codigo
               ), s.acompanamiento_at
          from public.respuestas r
          join public.solicitudes s on s.id = r.solicitud_id
         where r.autor_id = auth.uid()
           and s.flujo = 'acompanado'
           and s.acompanamiento_at is not null
           and not exists (select 1 from public.conversaciones c
                            where c.solicitud_id = s.id
                              and c.ofertador_id = auth.uid())

        union all

        -- 5 · Reportes sin atender. Solo para el administrador.
        select jsonb_build_object(
                 'tipo',  'reporte',
                 'texto', 'Hay un reporte sin atender',
                 'fecha', rp.creado_at,
                 'href',  '/admin'
               ), rp.creado_at
          from public.reportes rp
         where rp.atendido = false
           and public.es_admin(auth.uid())
      ) t
      order by fecha desc
      limit 30
    ) u;
$$;

revoke execute on function public.mis_avisos() from public, anon;
grant  execute on function public.mis_avisos() to authenticated;

create or replace function public.marcar_avisos_vistos()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.perfiles set avisos_vistos_at = now() where id = auth.uid();
$$;

revoke execute on function public.marcar_avisos_vistos() from public, anon;
grant  execute on function public.marcar_avisos_vistos() to authenticated;

-- ---------------------------------------------------------------------
-- 4. Lo que necesita el encabezado, en una sola consulta
--
-- Corre en CADA carga de CADA página, y ya hacía tres consultas. El
-- contador viaja en la que ya existía en vez de abrir una cuarta.
--
-- Sustituye a `mi_menu_coordinacion()`, que tenía un día y un solo uso.
-- ---------------------------------------------------------------------

create or replace function public.estado_encabezado()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'coordinacion', case
      when public.soy_aliado() then 'organizacion'
      when exists (select 1 from public.conversaciones c
                    where c.ofertador_id = auth.uid()) then 'coordinacion'
    end,
    'avisos_sin_ver', (
      select count(*)
        from jsonb_array_elements(public.mis_avisos()) a
       where (a->>'fecha')::timestamptz >
             coalesce((select p.avisos_vistos_at from public.perfiles p
                        where p.id = auth.uid()),
                      '-infinity'::timestamptz)
    )
  );
$$;

revoke execute on function public.estado_encabezado() from public, anon;
grant  execute on function public.estado_encabezado() to authenticated;

comment on function public.estado_encabezado() is
  'Todo lo que el encabezado necesita saber de quien mira, en una consulta: si se dibuja la pestaña de /aliado y con qué nombre, y cuántos avisos hay sin ver. No autoriza nada.';

drop function if exists public.mi_menu_coordinacion();

-- Comprobar:
--   select public.mis_avisos();
--   select public.estado_encabezado();
--   -- Tras marcar_avisos_vistos(), `avisos_sin_ver` tiene que dar 0.
