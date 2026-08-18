-- =====================================================================
-- v2 · L1 · Límite de tasa (y, desde commit 5, cola de avisos)
--
-- Dos responsabilidades salen del camino de la petición y bajan a
-- Postgres. Este archivo se llena en dos pasos:
--   · Commit 4 (este bloque): límite de tasa — `limites_tasa`,
--     `consumir_limite`, purga horaria.
--   · Commit 5: la cola transaccional de avisos —`avisos_pendientes`,
--     sus RPC y el drenado por `pg_cron`→`pg_net`— se AÑADE debajo.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Límite de tasa: ventana fija, clave hasheada con pepper, autopurga.
--
-- La clave (nombre de ruta + IP del cliente) nunca se guarda en claro:
-- se hashea con el pepper del Vault, igual que un documento (regla 6, sin
-- PII en la base). La tabla es efímera —se purga cada hora— y no cuelga
-- de nada: es telemetría de seguridad, no un dato de solicitud.
-- ---------------------------------------------------------------------

create table if not exists public.limites_tasa (
  clave          text primary key,
  ventana_inicio timestamptz not null default now(),
  conteo         int not null default 0
);
alter table public.limites_tasa enable row level security;  -- sin políticas: cerrada

-- La llama `limitar()` desde el backend con el rol de servicio. Revocada de
-- todo lo demás: anon y authenticated no la ven, solo service_role la
-- ejecuta (por los privilegios por defecto de Supabase, que sobreviven al
-- revoke de public).
create or replace function public.consumir_limite(p_clave text, p_max int, p_ventana_seg int)
  returns boolean
  language plpgsql security definer set search_path = ''
  as $$
  declare v_hash text; v_conteo int;
  begin
    v_hash := public.hash_con_pepper(p_clave);  -- nunca se guarda la IP en claro
    insert into public.limites_tasa (clave, ventana_inicio, conteo)
      values (v_hash, now(), 1)
    on conflict (clave) do update set
      ventana_inicio = case when public.limites_tasa.ventana_inicio
                             < now() - make_interval(secs => p_ventana_seg)
                            then now() else public.limites_tasa.ventana_inicio end,
      conteo = case when public.limites_tasa.ventana_inicio
                         < now() - make_interval(secs => p_ventana_seg)
                        then 1 else public.limites_tasa.conteo + 1 end
    returning conteo into v_conteo;
    return v_conteo <= p_max;
  end $$;
revoke execute on function public.consumir_limite(text,int,int) from public, anon, authenticated;

comment on function public.consumir_limite(text,int,int) is
  'Ventana fija de límite de tasa. Devuelve true si el cliente puede continuar. La clave se hashea con pepper del Vault: la IP nunca se guarda en claro (regla 6). La llama limitar() con el rol de servicio.';

-- Purga horaria: una ventana de más de una hora ya no le sirve a nadie.
-- cron.schedule upserta por nombre, así que re-correr el esquema es seguro.
select cron.schedule('purgar-limites', '0 * * * *',
  $$delete from public.limites_tasa where ventana_inicio < now() - interval '1 hour'$$);

-- ---------------------------------------------------------------------
-- Cola de avisos (commit 5). El envío de push sale del camino de la
-- petición: las RPC encolan aquí en su misma transacción, y un cron drena
-- la cola llamando a un endpoint de Vercel vía pg_net. Sin PII: ids, código
-- público y claves de plantilla.
-- ---------------------------------------------------------------------

create extension if not exists pg_net;

create table if not exists public.avisos_pendientes (
  id           uuid primary key default extensions.gen_random_uuid(),
  tipo         text not null check (tipo in
                 ('respuesta','ofertadores','conversacion','acompanamiento')),
  payload      jsonb not null,
  creado_at    timestamptz not null default now(),
  intentos     int not null default 0,
  reclamado_at timestamptz
);
alter table public.avisos_pendientes enable row level security;  -- sin políticas: cerrada

-- Interna: la llaman las RPC en su propia transacción.
create or replace function public.encolar_aviso(p_tipo text, p_payload jsonb) returns void
  language sql security definer set search_path = ''
  as $$ insert into public.avisos_pendientes (tipo, payload) values (p_tipo, p_payload) $$;
revoke execute on function public.encolar_aviso(text,jsonb) from public, anon, authenticated;

-- Reclama un lote y lo marca; SKIP LOCKED evita que dos tics choquen. Un
-- aviso con 5 intentos ya no se devuelve: se abandona a propósito.
create or replace function public.reclamar_avisos(p_limite int)
  returns setof public.avisos_pendientes
  language plpgsql security definer set search_path = ''
  as $$
  begin
    return query
    update public.avisos_pendientes a set reclamado_at = now(), intentos = intentos + 1
     where a.id in (
       select id from public.avisos_pendientes
        where intentos < 5
          and (reclamado_at is null or reclamado_at < now() - interval '5 minutes')
        order by creado_at
        for update skip locked
        limit p_limite)
    returning a.*;
  end $$;
revoke execute on function public.reclamar_avisos(int) from public, anon, authenticated;

create or replace function public.marcar_aviso_procesado(p_id uuid) returns void
  language sql security definer set search_path = ''
  as $$ delete from public.avisos_pendientes where id = p_id $$;  -- borrado duro (regla 4)
revoke execute on function public.marcar_aviso_procesado(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Las 7 RPC ahora encolan su aviso en la misma transacción. `create or
-- replace` conserva los grants existentes; solo cambia el cuerpo. Copias
-- exactas de supabase/schema.sql (misma fuente, mismo commit).
-- ---------------------------------------------------------------------

create or replace function public.crear_solicitud(
  p_municipio   text,
  p_barrio      text,
  p_categoria   text,
  p_nota        text,
  p_items       jsonb,
  p_token       text,
  p_puede_recoger boolean default false
)
returns table (solicitud_id uuid, codigo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id          uuid;
  v_codigo      text;
  v_item        jsonb;
  v_sugerencia  text;
  v_sug_id      uuid;
  v_n_sugeridos integer := 0;
  v_item_ids    text[] := '{}';
  v_es_prueba   boolean := trim(p_barrio) ilike 'prueba%';
begin
  if public.contiene_pii(p_nota) then
    raise exception 'La nota no puede contener teléfonos ni correos';
  end if;

  -- El barrio también: se ve en la tarjeta del tablero público, igual que
  -- la nota, y hasta ahora solo lo filtraba el cliente.
  if public.contiene_pii(p_barrio) then
    raise exception 'El barrio no puede contener teléfonos ni correos';
  end if;

  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 12 then
    raise exception 'Debe incluir entre 1 y 12 ítems';
  end if;

  v_codigo := public.generar_codigo();

  insert into public.solicitudes (codigo, token_hash, municipio, barrio, categoria,
                                  nota, es_prueba, puede_recoger)
  values (v_codigo, encode(extensions.digest(p_token, 'sha256'), 'hex'),
          p_municipio, p_barrio, p_categoria, nullif(trim(p_nota), ''), v_es_prueba,
          coalesce(p_puede_recoger, false))
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_sugerencia := nullif(trim(v_item->>'sugerencia'), '');

    if v_sugerencia is null then
      insert into public.solicitud_items (solicitud_id, item_id, cantidad)
      values (v_id, v_item->>'item_id', (v_item->>'cantidad')::numeric);
      -- Solo los ítems del catálogo cruzan con inventarios; las sugerencias
      -- todavía no son un ítem con el que se pueda cruzar (igual que antes).
      v_item_ids := array_append(v_item_ids, v_item->>'item_id');
    else
      v_n_sugeridos := v_n_sugeridos + 1;
      if v_n_sugeridos > 3 then
        raise exception 'Puedes sugerir máximo 3 cosas que no estén en la lista';
      end if;

      if char_length(v_sugerencia) < 2 or char_length(v_sugerencia) > 60 then
        raise exception 'El nombre de lo que sugieres debe tener entre 2 y 60 caracteres';
      end if;

      if public.contiene_pii(v_sugerencia) then
        raise exception 'El nombre de lo que sugieres no puede contener teléfonos ni correos';
      end if;

      insert into public.sugerencias_item (nombre_propuesto, categoria_sugerida, origen, es_prueba)
      values (v_sugerencia, p_categoria, 'solicitante', v_es_prueba)
      returning id into v_sug_id;

      insert into public.solicitud_items (solicitud_id, sugerencia_id, cantidad)
      values (v_id, v_sug_id, (v_item->>'cantidad')::numeric);
    end if;
  end loop;

  -- Aviso a quienes ofrecen en ese municipio. Va a la cola y lo despacha el
  -- cron; antes lo mandaba la ruta después de responder. Sin PII: municipio
  -- y categoría ya están en el tablero público, los ítems son del catálogo.
  perform public.encolar_aviso('ofertadores', jsonb_build_object(
    'municipio_codigo', p_municipio,
    'categoria',        p_categoria,
    'item_ids',         to_jsonb(v_item_ids)));

  return query select v_id, v_codigo;
end;
$$;

create or replace function public.responder_solicitud(
  p_codigo       text,
  p_mensaje      text,
  p_puede_llevar boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_solicitud_id uuid;
  v_codigo text;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if not exists (select 1 from public.perfiles p
                  where p.id = v_uid and p.suspendido = false) then
    raise exception 'Necesitas completar tu perfil antes de responder';
  end if;

  -- Sin contacto publico no hay respuesta posible: el flujo directo se
  -- sostiene sobre que quien pidio pueda escribirle a quien ofrecio. Un
  -- perfil de aliado no tiene contacto, y por eso no responde por aqui —
  -- para el flujo acompanado existe iniciar_conversacion.
  if not exists (select 1 from public.perfiles p
                  where p.id = v_uid and p.contacto_publico is not null) then
    raise exception 'Para responder necesitas una forma de contacto en tu perfil: si no, quien pidio ayuda no tiene a donde escribirte';
  end if;

  -- Se captura también el código guardado, no el `p_codigo` crudo del
  -- cliente: es el que viaja en el aviso.
  select s.id, s.codigo into v_solicitud_id, v_codigo
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

  insert into public.respuestas (solicitud_id, autor_id, mensaje, puede_llevar)
  values (v_solicitud_id, v_uid, trim(p_mensaje), coalesce(p_puede_llevar, false));

  -- Aviso al solicitante. A la cola; lo despacha el cron. Solo id y código.
  perform public.encolar_aviso('respuesta', jsonb_build_object(
    'solicitud_id', v_solicitud_id,
    'codigo',       v_codigo));

  return v_solicitud_id;
end;
$$;

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

  -- Aviso a quienes ya habían ofrecido: ahora hay fundación coordinando. A
  -- la cola; lo despacha el cron. Antes lo mandaba /api/acompanamiento.
  perform public.encolar_aviso('acompanamiento', jsonb_build_object(
    'solicitud_id', v_sol.id,
    'codigo',       v_sol.codigo));

  return jsonb_build_object(
    'codigo',       v_sol.codigo,
    'organizacion', v_org.nombre
  );
end;
$$;

create or replace function public.enviar_mensaje(p_conversacion_id uuid, p_cuerpo text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text := public.rol_en_conversacion(p_conversacion_id);
  v_id  uuid;
begin
  if v_rol is null then
    raise exception 'No autorizado';
  end if;

  if char_length(trim(p_cuerpo)) < 1 or char_length(p_cuerpo) > 1000 then
    raise exception 'El mensaje debe tener entre 1 y 1000 caracteres';
  end if;

  if public.contiene_contacto(p_cuerpo) then
    raise exception 'No escribas teléfonos, correos ni enlaces de mensajería: la coordinación ocurre aquí';
  end if;

  insert into public.mensajes (conversacion_id, autor_rol, autor_perfil_id, cuerpo)
  values (p_conversacion_id, v_rol, auth.uid(), trim(p_cuerpo))
  returning id into v_id;

  -- Aviso a los otros dos del hilo. A la cola; lo despacha el cron. Se
  -- excluye a quien escribe (tiene cuenta): no se avisa a sí mismo.
  perform public.encolar_aviso('conversacion', jsonb_build_object(
    'conversacion_id',     p_conversacion_id,
    'plantilla',           'mensaje_nuevo',
    'excluir_perfil',      auth.uid(),
    'excluir_solicitante', false));

  return v_id;
end;
$$;

create or replace function public.enviar_mensaje_token(
  p_token text,
  p_conversacion_id uuid,
  p_cuerpo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- El token no autoriza «cualquier conversación»: solo las de SU
  -- solicitud. Sin esta comprobación, quien tenga un token cualquiera
  -- podría escribir en el hilo de otra persona.
  if not exists (
    select 1 from public.conversaciones c
      join public.solicitudes s on s.id = c.solicitud_id
     where c.id = p_conversacion_id
       and s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  ) then
    raise exception 'No autorizado';
  end if;

  if char_length(trim(p_cuerpo)) < 1 or char_length(p_cuerpo) > 1000 then
    raise exception 'El mensaje debe tener entre 1 y 1000 caracteres';
  end if;

  if public.contiene_contacto(p_cuerpo) then
    raise exception 'No escribas tu teléfono ni tu correo: la coordinación ocurre aquí, y así queda constancia';
  end if;

  insert into public.mensajes (conversacion_id, autor_rol, autor_perfil_id, cuerpo)
  values (p_conversacion_id, 'solicitante', null, trim(p_cuerpo))
  returning id into v_id;

  -- Aviso a los otros dos del hilo. Quien escribe es el solicitante (sin
  -- cuenta): se excluye por esa vía, no por perfil.
  perform public.encolar_aviso('conversacion', jsonb_build_object(
    'conversacion_id',     p_conversacion_id,
    'plantilla',           'mensaje_nuevo',
    'excluir_perfil',      null,
    'excluir_solicitante', true));

  return v_id;
end;
$$;

create or replace function public.abrir_entrega_directa(
  p_solicitud_id uuid,
  p_mensaje      text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_sol  public.solicitudes;
  v_conv uuid;
begin
  select * into v_sol from public.solicitudes s
   where s.id = p_solicitud_id
     and public.estado_activo(s.estado)
     and s.expira_at > now();

  if v_sol.id is null then
    raise exception 'Esa solicitud ya no está disponible';
  end if;

  -- Innegociable, y por la misma razón que en `coincidencias_para_aliado`:
  -- sin esto la fundación podría abrirle un hilo a alguien del Flujo 1, que
  -- nunca aceptó nada. Sería la regla R rota por la puerta de atrás.
  if v_sol.flujo <> 'acompanado' then
    raise exception 'Esa solicitud no tiene acompañamiento';
  end if;

  if not public.es_miembro_activo(v_sol.organizacion_id, v_uid) then
    raise exception 'No autorizado';
  end if;

  if char_length(trim(p_mensaje)) < 10 or char_length(p_mensaje) > 1000 then
    raise exception 'El mensaje debe tener entre 10 y 1000 caracteres';
  end if;

  -- Regla M, igual que en cualquier otro hilo. No se relaja porque quien
  -- escribe sea la fundación.
  if public.contiene_contacto(p_mensaje) then
    raise exception 'No escribas teléfonos, correos ni enlaces de mensajería';
  end if;

  insert into public.conversaciones
    (solicitud_id, ofertador_id, aliado_id, organizacion_id, estado, directa)
  values
    (v_sol.id, null, v_uid, v_sol.organizacion_id, 'abierta', true)
  on conflict (solicitud_id) where directa do nothing
  returning id into v_conv;

  if v_conv is null then
    raise exception 'Ya abriste una conversación de entrega para esta solicitud';
  end if;

  -- Sin `aquive.mensaje_inicial`: el hilo ya nace `abierta` y el trigger lo
  -- deja pasar. Esa excepción solo hace falta cuando nace `asignada`.
  insert into public.mensajes (conversacion_id, autor_rol, autor_perfil_id, cuerpo)
  values (v_conv, 'aliado', v_uid, trim(p_mensaje));

  update public.solicitudes set estado = 'en_coordinacion'
   where id = v_sol.id and estado = 'abierta';

  -- Aviso al ofertador de que la fundación va a coordinar. A la cola; lo
  -- despacha el cron. Se excluye al aliado que abre el hilo.
  perform public.encolar_aviso('conversacion', jsonb_build_object(
    'conversacion_id',     v_conv,
    'plantilla',           'entrega_directa',
    'excluir_perfil',      v_uid,
    'excluir_solicitante', false));

  return v_conv;
end;
$$;

create or replace function public.invitar_a_conversacion(
  p_solicitud_id uuid,
  p_ofertador_id uuid,
  p_mensaje      text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_sol  public.solicitudes;
  v_conv uuid;
begin
  select * into v_sol from public.solicitudes s
   where s.id = p_solicitud_id
     and public.estado_activo(s.estado)
     and s.expira_at > now();

  if v_sol.id is null then
    raise exception 'Esa solicitud ya no está disponible';
  end if;

  if v_sol.flujo <> 'acompanado' then
    raise exception 'Esa solicitud no tiene acompañamiento';
  end if;

  if not public.es_miembro_activo(v_sol.organizacion_id, v_uid) then
    raise exception 'No autorizado';
  end if;

  if char_length(trim(p_mensaje)) < 10 or char_length(p_mensaje) > 1000 then
    raise exception 'El mensaje debe tener entre 10 y 1000 caracteres';
  end if;

  if public.contiene_contacto(p_mensaje) then
    raise exception 'No escribas teléfonos, correos ni enlaces de mensajería';
  end if;

  if not public.puede_ofrecer(p_ofertador_id) then
    raise exception 'Esa persona no está disponible para ofrecer';
  end if;

  -- ⚠ El primer mensaje lo firma el ALIADO, nunca el ofertador. Crear un
  -- hilo en nombre de alguien y ponerle palabras es lo que no se puede
  -- hacer: quien ofrece recibe una invitación, no un mensaje suyo que no
  -- escribió.
  insert into public.conversaciones
    (solicitud_id, ofertador_id, aliado_id, organizacion_id, estado)
  values
    (v_sol.id, p_ofertador_id, v_uid, v_sol.organizacion_id, 'abierta')
  on conflict (solicitud_id, ofertador_id) do nothing
  returning id into v_conv;

  if v_conv is null then
    raise exception 'Ya hay una conversación con esa persona sobre esta solicitud';
  end if;

  insert into public.mensajes (conversacion_id, autor_rol, autor_perfil_id, cuerpo)
  values (v_conv, 'aliado', v_uid, trim(p_mensaje));

  update public.solicitudes set estado = 'en_coordinacion'
   where id = v_sol.id and estado = 'abierta';

  -- Aviso de la invitación a quien ofrece. A la cola; lo despacha el cron.
  -- Se excluye al aliado que invita.
  perform public.encolar_aviso('conversacion', jsonb_build_object(
    'conversacion_id',     v_conv,
    'plantilla',           'invitacion',
    'excluir_perfil',      v_uid,
    'excluir_solicitante', false));

  return v_conv;
end;
$$;

-- Drenado: pg_cron dispara pg_net contra el endpoint de Vercel cada minuto.
-- La URL y el secreto salen del Vault, nunca del repositorio.
select cron.schedule('drenar-avisos', '* * * * *', $drenar$
  select net.http_post(
    url     := public.secreto_vault('aquive_tarea_url'),
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-tarea-secret', public.secreto_vault('aquive_tarea_secret')),
    body    := '{}'::jsonb)
$drenar$);
