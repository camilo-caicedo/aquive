-- =====================================================================
-- v2 · Arreglo — responder exige tener contacto público
--
-- Regresión que introdujo la Fase D. Al hacer `contacto_publico` nullable
-- para los aliados quedó abierto un camino que no debería existir: un
-- perfil de aliado —que se crea al entrar por /unirse y NO tiene contacto—
-- podía responder una solicitud del flujo directo.
--
-- El resultado era una respuesta a la que no se le puede escribir. Y algo
-- peor: la pantalla de quien pidió ayuda reventaba entera al intentar
-- armar el enlace de WhatsApp con un `null`, así que dejaba de ver TODAS
-- sus respuestas, no solo esa.
--
-- El arreglo va en los tres sitios donde falló:
--   1. Aquí, que es la causa: sin contacto no se responde.
--   2. En `src/lib/types.ts`, donde `contacto` decía ser siempre `string`.
--   3. En `lista-respuestas.tsx`, que ahora sabe mostrar una respuesta sin
--      contacto en vez de tumbar la pantalla — las que se escribieron
--      antes de este arreglo siguen ahí.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

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

  -- Sin contacto público no hay respuesta posible: el flujo directo se
  -- sostiene sobre que quien pidió pueda escribirle a quien ofreció. Un
  -- perfil de aliado no tiene contacto, y por eso no responde por aquí —
  -- para el flujo acompañado existe `iniciar_conversacion`.
  if not exists (select 1 from public.perfiles p
                  where p.id = v_uid and p.contacto_publico is not null) then
    raise exception 'Para responder necesitas una forma de contacto en tu perfil: si no, quien pidió ayuda no tiene a dónde escribirte';
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

-- Comprobar:
--   -- Con un perfil de aliado (contacto_publico null), responder falla.
--   -- Con un ofertador, sigue funcionando igual que siempre.
--   select count(*) from public.respuestas r
--     join public.perfiles p on p.id = r.autor_id
--    where p.contacto_publico is null;   -- las que quedaron de antes
