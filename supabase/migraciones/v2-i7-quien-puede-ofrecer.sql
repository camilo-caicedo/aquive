-- =====================================================================
-- v2 · Arreglo — «quién puede ofrecer» se define una sola vez
--
-- Estaba escrito de tres formas distintas, y por eso fallaba:
--
--   · `responder_solicitud`: perfil no suspendido y CON contacto público.
--   · `invitar_a_conversacion`: `tipo = 'ofertador'`.
--   · `v_cruces`: `tipo = 'ofertador'` también.
--
-- La segunda reventaba con «esa persona no está disponible para ofrecer»
-- al invitar a alguien de tipo `servidor` que había respondido — cosa que
-- `responder_solicitud` permite, y con razón: un profesional con matrícula
-- también puede tener tres mercados en la casa. `ofertadores_publicos` ya
-- lo tenía claro desde la Fase A: sale quien sea `ofertador` Y TAMBIÉN
-- cualquiera que haya declarado insumos.
--
-- La definición buena es la de `responder_solicitud`, y es una sola frase:
-- **puede ofrecer quien no está suspendido y tiene contacto público**. Lo
-- segundo excluye solo a los aliados, que no tienen contacto — y esos no
-- deben aparecer como candidatos a entregarse cosas a sí mismos, que era
-- lo que el `tipo = 'ofertador'` protegía de verdad.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

create or replace function public.puede_ofrecer(p_perfil_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
     where p.id = p_perfil_id
       and p.suspendido = false
       -- Con contacto público. Deja fuera a los aliados, que no lo tienen:
       -- un aliado no puede ser candidato a entregarse cosas a sí mismo.
       and p.contacto_publico is not null
  );
$$;

revoke execute on function public.puede_ofrecer(uuid) from public, anon;
grant  execute on function public.puede_ofrecer(uuid) to authenticated;

comment on function public.puede_ofrecer(uuid) is
  'Quién puede ofrecer ayuda: no suspendido y con contacto público. Definición única — la usan invitar_a_conversacion y v_cruces, y es la misma que exige responder_solicitud. No mira el tipo del perfil: un servidor con matrícula también puede tener cobijas.';

-- 1 · La invitación desde el panel del aliado.
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

  return v_conv;
end;
$$;

revoke execute on function public.invitar_a_conversacion(uuid,uuid,text) from public, anon;
grant  execute on function public.invitar_a_conversacion(uuid,uuid,text) to authenticated;

-- 2 · El cruce por inventario. Con `tipo = 'ofertador'` se quedaban fuera
-- los profesionales con matrícula que además declaran insumos, que es
-- justo a quien `ofertadores_publicos` sí muestra.
create or replace view public.v_cruces as
select
  s.id          as solicitud_id,
  s.codigo,
  s.municipio,
  s.flujo,
  s.organizacion_id,
  o.id          as ofertador_id,
  count(*)      as items_coincidentes,
  jsonb_agg(jsonb_build_object(
    'nombre',   coalesce(c.nombre, sg.nombre_propuesto),
    'cantidad', si.cantidad,
    'unidad',   coalesce(c.unidad, sg.unidad_sugerida, 'unidad')
  ) order by coalesce(c.orden, 9999)) as detalle
from public.solicitud_items si
join public.solicitudes s on s.id = si.solicitud_id
join public.ofrecimientos ofr
     on (ofr.item_id is not null and ofr.item_id = si.item_id)
     or (ofr.sugerencia_id is not null and ofr.sugerencia_id = si.sugerencia_id)
join public.perfiles o on o.id = ofr.perfil_id
left join public.catalogo_items c    on c.id = si.item_id
left join public.sugerencias_item sg on sg.id = si.sugerencia_id
where si.cubierto = false
  and ofr.disponible = true
  and public.estado_activo(s.estado)
  and s.expira_at > now()
  and s.municipio = any(o.municipios)
  and public.puede_ofrecer(o.id)
group by s.id, s.codigo, s.municipio, s.flujo, s.organizacion_id, o.id;

revoke all on public.v_cruces from anon, authenticated;

-- Comprobar:
--   select public.puede_ofrecer(id), tipo, contacto_publico is null as sin_contacto
--     from public.perfiles;
--   -- Un `servidor` con contacto: true. Un `aliado`: false.
