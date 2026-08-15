-- =====================================================================
-- v2 · A quién avisar cuando pasa algo en una coordinación
--
-- El panel de avisos ya muestra los mensajes nuevos, las invitaciones y
-- el acompañamiento, pero hay que abrirlo. Estas dos funciones dicen a
-- qué dispositivos mandar el push, y nada más: quien envía es `web-push`
-- desde Node, porque Postgres no habla el protocolo.
--
-- Van revocadas para todos. Solo la llave de servicio las llama, igual
-- que `destinatarios_aviso`: una lista de endpoints es material para
-- mandarle notificaciones a desconocidos.
--
-- No hay preferencia separada, y es deliberado por ahora: la suscripción
-- es la misma que la de «solicitud nueva en tu municipio». Quien apague
-- una, apaga las dos.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Los otros dos de un hilo
--
-- Los tres participantes guardan su suscripción en sitios distintos, y
-- eso no es descuido: quien pide ayuda no tiene cuenta, así que la suya
-- cuelga de la solicitud y muere con ella; las de quien ofrece y quien
-- coordina cuelgan de su perfil. Por eso vuelve `de_solicitante`, para
-- saber en qué tabla borrar la que el navegador ya botó.
--
-- Solo el aliado A CARGO, no el equipo entero de la fundación: un hilo
-- sin nadie a cargo no acepta mensajes (regla L), así que no hay caso en
-- que valga la pena despertar a cinco personas.
-- ---------------------------------------------------------------------

create or replace function public.destinatarios_conversacion(
  p_conversacion_id     uuid,
  p_excluir_perfil      uuid    default null,
  p_excluir_solicitante boolean default false
)
returns table (
  suscripcion_id uuid,
  de_solicitante boolean,
  endpoint       text,
  p256dh         text,
  auth_key       text,
  codigo         text
)
language sql
security definer
stable
set search_path = ''
as $$
  -- Quien pidió ayuda: por token, sin cuenta.
  select ps.id, true, ps.endpoint, ps.p256dh, ps.auth_key, s.codigo
    from public.conversaciones c
    join public.solicitudes s        on s.id = c.solicitud_id
    join public.push_suscripciones ps on ps.solicitud_id = s.id
   where c.id = p_conversacion_id
     and p_excluir_solicitante = false

  union all

  -- Quien ofrece y quien coordina: por perfil.
  select po.id, false, po.endpoint, po.p256dh, po.auth_key, s.codigo
    from public.conversaciones c
    join public.solicitudes s   on s.id = c.solicitud_id
    join public.perfiles p      on p.id in (c.ofertador_id, c.aliado_id)
    join public.push_ofertadores po on po.perfil_id = p.id
   where c.id = p_conversacion_id
     and p.suspendido = false
     and p.id is distinct from p_excluir_perfil;
$$;

revoke execute on function public.destinatarios_conversacion(uuid,uuid,boolean)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Quienes ya habían ofrecido ayuda en una solicitud
--
-- Para el aviso de que ahora hay una fundación coordinando: quien
-- respondió hace dos días no vuelve solo a mirar.
-- ---------------------------------------------------------------------

create or replace function public.destinatarios_respondieron(p_solicitud_id uuid)
returns table (
  suscripcion_id uuid,
  endpoint       text,
  p256dh         text,
  auth_key       text
)
language sql
security definer
stable
set search_path = ''
as $$
  select po.id, po.endpoint, po.p256dh, po.auth_key
    from public.respuestas r
    join public.perfiles p         on p.id = r.autor_id
    join public.push_ofertadores po on po.perfil_id = p.id
   where r.solicitud_id = p_solicitud_id
     and p.suspendido = false;
$$;

revoke execute on function public.destinatarios_respondieron(uuid)
  from public, anon, authenticated;

-- Comprobar (con la llave de servicio, no desde el navegador):
--   select * from public.destinatarios_conversacion('…');
--   select * from public.destinatarios_respondieron('…');
