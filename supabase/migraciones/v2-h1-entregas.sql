-- =====================================================================
-- v2 · Fase H — Coincidencias y entregas
--
-- Lo que le falta al aliado para hacer su trabajo: ver qué solicitudes
-- acompañadas calzan con lo que alguien tiene, recibir la entrega en el
-- acopio y dejar constancia de qué llegó.
--
-- Dos cosas que no son detalles:
--
--   · La entrega se confirma DOS veces (§8-F8). El aliado registra lo que
--     recibió; quien pidió confirma que lo recibió. Una sola confirmación
--     convierte «entregado» en la palabra de una de las partes.
--   · `entregas` SOBREVIVE al borrado de la solicitud (regla Q y §5.7-5).
--     Es el registro de que hubo ayuda —qué ítems, cuántos, qué
--     organización, qué municipio, cuándo— y no lleva ni un dato personal.
--     La planilla con nombres la exporta la fundación en el momento y la
--     custodia ella, que es la responsable.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Metadatos de lo que ya está cubierto
--
-- `cubierto` ya existía y sigue siendo el booleano que leen la vista del
-- cruce y la interfaz. Las dos columnas nuevas son metadato: quién lo
-- tachó y cuándo, para poder responder «¿desde cuándo dice que ya tiene
-- cobijas?» sin adivinar.
-- ---------------------------------------------------------------------

alter table public.solicitud_items
  add column if not exists cubierto_at timestamptz;
alter table public.solicitud_items
  add column if not exists cubierto_por text
    check (cubierto_por is null or cubierto_por in ('solicitante','aliado','entrega'));

-- ---------------------------------------------------------------------
-- 2. `entregas` — lo que queda cuando ya no queda nada
--
-- ⚠ SIN llave foránea a la solicitud, a propósito. La solicitud se borra a
-- las 72 horas y esta fila tiene que sobrevivirla: por eso el código va
-- como TEXTO copiado, no como referencia, y `conversacion_id` va en ON
-- DELETE SET NULL. Mismo razonamiento que `accesos_identidad`.
--
-- Aquí no hay PII: ítems, cantidades, organización, municipio y fechas.
-- ---------------------------------------------------------------------

create table if not exists public.entregas (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid references public.organizaciones(id) on delete set null,
  municipio       text not null,
  -- Uno de los dos, como en `solicitud_items`: del catálogo o sugerido.
  item_id         text references public.catalogo_items(id),
  sugerencia_id   uuid references public.sugerencias_item(id) on delete set null,
  cantidad        numeric(8,2) not null check (cantidad > 0 and cantidad <= 9999),
  recibido_at     timestamptz not null default now(),
  -- La segunda confirmación. NULL mientras quien pidió no diga que sí.
  confirmada_por_solicitante_at timestamptz,
  -- Copia en texto: la solicitud va a desaparecer.
  solicitud_codigo text not null,
  conversacion_id uuid references public.conversaciones(id) on delete set null,
  es_prueba       boolean not null default false,
  constraint entregas_uno_u_otro check (num_nonnulls(item_id, sugerencia_id) = 1)
);

comment on table public.entregas is
  'SOBREVIVE al borrado de la solicitud, y por eso no tiene FK hacia ella: el código va copiado en texto. Sin PII — ítems, cantidades, organización, municipio y fechas. La planilla con nombres la exporta la fundación en el momento de la entrega y la custodia ella (regla Q).';

create index if not exists idx_entregas_organizacion
  on public.entregas(organizacion_id, recibido_at desc);

alter table public.entregas enable row level security;
revoke all on public.entregas from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. El cruce, y por qué no puede ser una vista pública
--
-- ⚠ NO intentes resolver esto con `security_invoker`: `solicitudes` está
-- revocada y sin política de `select`, así que un aliado autenticado
-- recibiría «permission denied for table solicitudes», y `perfiles` solo
-- deja leer la fila propia, así que el join vaciaría el resultado igual
-- (§5.4).
--
-- La vista es interna. La única puerta es `coincidencias_para_aliado()`.
-- ---------------------------------------------------------------------

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
  -- ⚠ Imprescindible: sin esto, un aliado aparecería como candidato a
  -- entregarse cosas a sí mismo.
  and o.tipo = 'ofertador'
  and o.suspendido = false
group by s.id, s.codigo, s.municipio, s.flujo, s.organizacion_id, o.id;

revoke all on public.v_cruces from anon, authenticated;

comment on view public.v_cruces is
  'Vista INTERNA. Sin grant a anon ni authenticated: la única puerta es coincidencias_para_aliado(), que filtra por la organización de quien pregunta y por flujo = acompanado. Ver PLAN-V2 §5.4.';

create or replace function public.coincidencias_para_aliado()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x->>'items_coincidentes' desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'solicitud_id',       v.solicitud_id,
        'codigo',             v.codigo,
        'municipio',          m.nombre,
        'ofertador_id',       v.ofertador_id,
        'ofertador',          p.nombre_visible,
        'items_coincidentes', v.items_coincidentes,
        'detalle',            v.detalle,
        -- Si ya hay hilo con ese ofertador, el panel muestra «ya está en
        -- conversación» en vez de invitar otra vez.
        'ya_hay_hilo',        exists (select 1 from public.conversaciones c
                                       where c.solicitud_id = v.solicitud_id
                                         and c.ofertador_id = v.ofertador_id)
      ) as x
      from public.v_cruces v
      join public.municipios m on m.codigo_dane = v.municipio
      join public.perfiles p   on p.id = v.ofertador_id
      -- Las tres condiciones de §5.4, y la tercera es la que importa: sin
      -- ella el aliado vería solicitudes ANÓNIMAS del Flujo 1 en su panel,
      -- y el botón de conectar arrastraría a un solicitante que nunca
      -- aceptó nada a un hilo interno. Violaría la regla 3 y la R de golpe.
      where v.flujo = 'acompanado'
        and public.es_miembro_activo(v.organizacion_id, auth.uid())
    ) t;
$$;

revoke execute on function public.coincidencias_para_aliado() from public, anon;
grant  execute on function public.coincidencias_para_aliado() to authenticated;

-- ---------------------------------------------------------------------
-- 4. Registrar lo que llegó al acopio
--
-- Lo llama el aliado con la caja enfrente. Cada ítem que registra se tacha
-- en la solicitud, y de ahí sale el estado: `cumplida` si no queda nada
-- pendiente, `entregada_parcial` si falta algo.
--
-- El código de entrega que trae el ofertador es el uuid de la
-- conversación: opaco por construcción. NUNCA los cuatro últimos dígitos
-- del documento, que es lo que pide la regla 6 y lo que la gente haría por
-- comodidad.
-- ---------------------------------------------------------------------

create or replace function public.registrar_entrega(
  p_conversacion_id uuid,
  p_items           jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_conv     public.conversaciones;
  v_sol      public.solicitudes;
  v_item     jsonb;
  v_item_id  text;
  v_sug_id   uuid;
  v_n        integer := 0;
  v_pendientes integer;
begin
  select * into v_conv from public.conversaciones c where c.id = p_conversacion_id;

  if v_conv.id is null then
    raise exception 'Esa conversación no existe';
  end if;

  -- Solo la fundación registra entregas. Ni quien ofrece ni quien pide:
  -- el punto de la entrega en el acopio es que hay un tercero mirando.
  if not public.es_miembro_activo(v_conv.organizacion_id, v_uid) then
    raise exception 'No autorizado';
  end if;

  select * into v_sol from public.solicitudes s where s.id = v_conv.solicitud_id;

  if jsonb_array_length(p_items) < 1 then
    raise exception 'Marca al menos una cosa de las que llegaron';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_item_id := nullif(v_item->>'item_id', '');
    v_sug_id  := nullif(v_item->>'sugerencia_id', '')::uuid;

    if num_nonnulls(v_item_id, v_sug_id) <> 1 then
      raise exception 'Cada cosa entregada es del catálogo o sugerida, no las dos';
    end if;

    insert into public.entregas (
      organizacion_id, municipio, item_id, sugerencia_id, cantidad,
      solicitud_codigo, conversacion_id, es_prueba)
    values (
      v_conv.organizacion_id, v_sol.municipio, v_item_id, v_sug_id,
      (v_item->>'cantidad')::numeric, v_sol.codigo, v_conv.id, v_sol.es_prueba);

    update public.solicitud_items si
       set cubierto = true, cubierto_at = now(), cubierto_por = 'entrega'
     where si.solicitud_id = v_sol.id
       and ((v_item_id is not null and si.item_id = v_item_id)
         or (v_sug_id  is not null and si.sugerencia_id = v_sug_id));

    v_n := v_n + 1;
  end loop;

  select count(*) into v_pendientes
    from public.solicitud_items si
   where si.solicitud_id = v_sol.id and si.cubierto = false;

  -- `cumplida` no borra la solicitud: quien pidió tiene que poder
  -- confirmar que recibió, y para eso la solicitud sigue existiendo hasta
  -- que la cierre o venza. El borrado es de la Fase I.
  update public.solicitudes
     set estado = case when v_pendientes = 0 then 'cumplida' else 'entregada_parcial' end
   where id = v_sol.id;

  update public.conversaciones
     set estado = 'entregada'
   where id = p_conversacion_id;

  return jsonb_build_object(
    'registrados', v_n,
    'pendientes',  v_pendientes,
    'estado',      case when v_pendientes = 0 then 'cumplida' else 'entregada_parcial' end
  );
end;
$$;

revoke execute on function public.registrar_entrega(uuid,jsonb) from public, anon;
grant  execute on function public.registrar_entrega(uuid,jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 5. La segunda confirmación
--
-- La da quien pidió, con su token. Sin esto «entregado» sería la palabra
-- de una sola parte, y el registro que sobrevive vale bastante menos.
-- ---------------------------------------------------------------------

create or replace function public.confirmar_recepcion(p_token text, p_conversacion_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_n integer;
begin
  if not exists (
    select 1 from public.conversaciones c
      join public.solicitudes s on s.id = c.solicitud_id
     where c.id = p_conversacion_id
       and s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  ) then
    raise exception 'No autorizado';
  end if;

  update public.entregas
     set confirmada_por_solicitante_at = now()
   where conversacion_id = p_conversacion_id
     and confirmada_por_solicitante_at is null;

  get diagnostics v_n = row_count;

  if v_n = 0 then
    raise exception 'No hay nada pendiente de confirmar en esta entrega';
  end if;

  return v_n;
end;
$$;

grant execute on function public.confirmar_recepcion(text,uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Tachar un ítem a mano
--
-- Dos puertas otra vez: quien pidió, con su token —«esto ya lo conseguí
-- por otro lado»— y el aliado de la organización que la acompaña.
-- ---------------------------------------------------------------------

create or replace function public.marcar_item_cubierto(
  p_item_id  uuid,
  p_cubierto boolean,
  p_token    text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sol public.solicitudes;
  v_ok  boolean := false;
begin
  select s.* into v_sol
    from public.solicitud_items si
    join public.solicitudes s on s.id = si.solicitud_id
   where si.id = p_item_id;

  if v_sol.id is null then
    raise exception 'Ese ítem no existe';
  end if;

  if p_token is not null then
    v_ok := v_sol.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  else
    v_ok := public.es_miembro_activo(v_sol.organizacion_id, auth.uid());
  end if;

  if not v_ok then
    raise exception 'No autorizado';
  end if;

  update public.solicitud_items
     set cubierto = p_cubierto,
         cubierto_at = case when p_cubierto then now() end,
         cubierto_por = case when p_cubierto then
                          case when p_token is not null then 'solicitante' else 'aliado' end
                        end
   where id = p_item_id;
end;
$$;

grant execute on function public.marcar_item_cubierto(uuid,boolean,text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. La planilla
--
-- Regla Q: la plataforma no es el archivo de la fundación. Esto entrega
-- los datos EN EL MOMENTO de la entrega, para que la fundación los
-- custodie en sus propios sistemas como responsable que es.
--
-- Lleva PII, así que va por el mismo camino que `leer_identidad`: exige
-- motivo, exige el permiso de ver identidades, y deja rastro. No es una
-- descarga: es un acceso a datos personales, y se registra como tal.
-- ---------------------------------------------------------------------

create or replace function public.exportar_planilla(p_conversacion_id uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv    public.conversaciones;
  v_ident   public.identidades;
  v_datos   jsonb;
begin
  if char_length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Escribe para qué necesitas la planilla';
  end if;

  select * into v_conv from public.conversaciones c where c.id = p_conversacion_id;

  if v_conv.id is null then
    raise exception 'Esa conversación no existe';
  end if;

  select i.* into v_ident
    from public.identidades i where i.solicitud_id = v_conv.solicitud_id;

  if v_ident.id is null then
    raise exception 'Esta solicitud no tiene identidad registrada';
  end if;

  -- El mismo permiso que para leer una identidad, ni uno más laxo: una
  -- planilla es una identidad con una lista de cosas al lado.
  if not public.puede_leer_identidad(v_ident.id) then
    raise exception 'No autorizado';
  end if;

  perform public.registrar_acceso_identidad(v_ident.id, p_motivo, v_ident.es_prueba);

  select jsonb_agg(jsonb_build_object(
           'item',     coalesce(c.nombre, sg.nombre_propuesto),
           'cantidad', e.cantidad,
           'unidad',   coalesce(c.unidad, sg.unidad_sugerida, 'unidad'),
           'recibido_at', e.recibido_at,
           'confirmada', e.confirmada_por_solicitante_at is not null
         ) order by e.recibido_at)
    into v_datos
    from public.entregas e
    left join public.catalogo_items c    on c.id = e.item_id
    left join public.sugerencias_item sg on sg.id = e.sugerencia_id
   where e.conversacion_id = p_conversacion_id;

  return jsonb_build_object(
    'codigo',         (select s.codigo from public.solicitudes s where s.id = v_conv.solicitud_id),
    'nombre',         public.descifrar_texto(v_ident.nombre_cifrado),
    'documento_tipo', v_ident.documento_tipo,
    'documento',      public.descifrar_texto(v_ident.documento_cifrado),
    'telefono',       public.descifrar_texto(v_ident.telefono_cifrado),
    'autorizacion_version', v_ident.autorizacion_version,
    'autorizacion_at',      v_ident.autorizacion_at,
    'entregas',       coalesce(v_datos, '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.exportar_planilla(uuid,text) from public, anon;
grant  execute on function public.exportar_planilla(uuid,text) to authenticated;

-- Comprobar:
--   select has_table_privilege('authenticated','public.v_cruces','SELECT');   -- f
--   select has_table_privilege('anon','public.entregas','SELECT');            -- f
--
--   -- El cruce solo devuelve acompañadas, y solo de la organización de
--   -- quien pregunta. Con un aliado de otra organización: 0 filas.
--   -- Y una entrega registrada tiene que sobrevivir al borrado de su
--   -- solicitud, con `conversacion_id` en null y `solicitud_codigo` intacto.

-- ---------------------------------------------------------------------
-- 8. La pantalla de la entrega necesita saber qué falta
--
-- `leer_conversacion` gana los ítems pendientes de la solicitud. Van con
-- su identificador porque la pantalla de verificación es una lista de
-- botones grandes —a media luz y con guantes— y cada botón manda ese id.
--
-- Solo los pendientes: lo ya entregado no vuelve a la lista, que es lo
-- que evita registrar dos veces la misma caja.
-- ---------------------------------------------------------------------

create or replace function public.leer_conversacion(p_conversacion_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_rol  text := public.rol_en_conversacion(p_conversacion_id);
  v_conv public.conversaciones;
begin
  if v_rol is null then
    raise exception 'No autorizado';
  end if;

  select * into v_conv from public.conversaciones c where c.id = p_conversacion_id;

  return jsonb_build_object(
    'id',       v_conv.id,
    'estado',   v_conv.estado,
    'mi_rol',   v_rol,
    'codigo',   (select s.codigo from public.solicitudes s where s.id = v_conv.solicitud_id),
    'acopio',   (select jsonb_build_object('nombre', o.nombre,
                          'direccion', o.direccion_acopio,
                          'horario', o.horario_acopio)
                   from public.organizaciones o where o.id = v_conv.organizacion_id),
    'pendientes', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id',            si.id,
               'item_id',       si.item_id,
               'sugerencia_id', si.sugerencia_id,
               'nombre',        coalesce(c.nombre, sg.nombre_propuesto),
               'cantidad',      si.cantidad,
               'unidad',        coalesce(c.unidad, sg.unidad_sugerida, 'unidad')
             ) order by coalesce(c.orden, 9999)), '[]'::jsonb)
        from public.solicitud_items si
        left join public.catalogo_items c    on c.id = si.item_id
        left join public.sugerencias_item sg on sg.id = si.sugerencia_id
       where si.solicitud_id = v_conv.solicitud_id and si.cubierto = false),
    'mensajes', public.mensajes_de(p_conversacion_id)
  );
end;
$$;

revoke execute on function public.leer_conversacion(uuid) from public, anon;
grant  execute on function public.leer_conversacion(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 9. Invitar desde el panel — F7
--
-- El aliado ve la coincidencia y abre el hilo él mismo. Nace `abierta` y
-- con él ya a cargo: es la regla L cumplida desde el primer segundo, y de
-- paso evita el estado raro de un hilo que alguien abrió para otro.
--
-- ⚠ El primer mensaje lo firma el ALIADO, nunca el ofertador. Crear un
-- hilo en nombre de alguien y ponerle palabras es exactamente lo que no
-- se puede hacer: quien ofrece recibe una invitación, no un mensaje suyo
-- que no escribió.
-- ---------------------------------------------------------------------

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

  if not exists (select 1 from public.perfiles p
                  where p.id = p_ofertador_id
                    and p.tipo = 'ofertador'
                    and p.suspendido = false) then
    raise exception 'Esa persona no está disponible para ofrecer';
  end if;

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
