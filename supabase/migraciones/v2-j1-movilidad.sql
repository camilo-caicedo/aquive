-- =====================================================================
-- v2 · Quién puede moverse, dicho una vez
--
-- La pregunta que más se repetía en el chat era la logística: quién lleva,
-- quién recoge, si alguien puede desplazarse. Es un dato estable —de la
-- persona y de la solicitud— y no tenía por qué negociarse cada vez.
--
-- Tres booleanos, y los tres SIEMPRE EN POSITIVO. Marcado afirma una
-- capacidad; sin marcar no afirma nada. Nunca «no puedo»: un campo así,
-- público y filtrable, convertiría el tablero en una lista de a quién le
-- cuesta desplazarse, y eso es exactamente lo que la regla 1 prohíbe
-- guardar (estado de salud o discapacidad).
--
-- Por lo mismo, `solicitudes.puede_recoger` NO entra en
-- `solicitudes_publicas`, que la lee `anon`. Se lee con el token, con la
-- RPC de abajo si hay sesión, o dentro del panel de la fundación.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Las tres columnas
-- ---------------------------------------------------------------------

alter table public.perfiles
  add column if not exists puede_trasladarse boolean not null default false;

comment on column public.perfiles.puede_trasladarse is
  'Declara que puede desplazarse a entregar. Público, como el resto de la ficha de quien ofrece. En positivo: false no afirma que NO pueda, solo que no lo dijo.';

alter table public.respuestas
  add column if not exists puede_llevar boolean not null default false;

comment on column public.respuestas.puede_llevar is
  'Para ESTA entrega en concreto. Se precarga de perfiles.puede_trasladarse, y se puede desmarcar: se puede tener carro y no poder ese día.';

alter table public.solicitudes
  add column if not exists puede_recoger boolean not null default false;

comment on column public.solicitudes.puede_recoger is
  'Quien pidió puede ir a recoger. NO va en `solicitudes_publicas`: un tablero filtrable por esto sería un directorio de quién no puede moverse. Ver regla 1.';

-- ---------------------------------------------------------------------
-- 2. Quien ofrece lo declara en su perfil
--
-- El parámetro va AL FINAL y con default: así las llamadas que ya existen
-- siguen resolviendo a esta misma función.
-- ---------------------------------------------------------------------

create or replace function public.crear_perfil(
  p_nombre_visible    text,
  p_tipo              text,
  p_municipios        text[],
  p_contacto_publico  text,
  p_contacto_tipo     text,
  p_descripcion       text,
  p_profesion         text default null,
  p_entidad_matricula text default null,
  p_numero_matricula  text default null,
  p_servicios         text[] default '{}',
  p_puede_trasladarse boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if p_tipo not in ('ofertador','servidor','aliado') then
    raise exception 'Tipo de perfil no válido';
  end if;

  if coalesce(array_length(p_municipios, 1), 0) = 0 then
    raise exception 'Elige al menos un municipio';
  end if;

  -- `aliado` está en la lista de tipos permitidos aunque nadie se declare
  -- aliado desde /registro; el tipo aparece al unirse a una organización, y
  -- esto existe para que un aliado pueda editar su nombre sin que la RPC lo
  -- rechace.
  insert into public.perfiles (
    id, nombre_visible, tipo, municipios, contacto_publico,
    contacto_tipo, descripcion, acepto_publicacion, acepto_politica_at,
    puede_trasladarse)
  values (
    v_uid, p_nombre_visible, p_tipo, p_municipios,
    case when p_tipo = 'aliado' then null else p_contacto_publico end,
    case when p_tipo = 'aliado' then 'whatsapp' else p_contacto_tipo end,
    nullif(trim(p_descripcion), ''),
    p_tipo <> 'aliado', now(),
    coalesce(p_puede_trasladarse, false))
  on conflict (id) do update set
    nombre_visible     = excluded.nombre_visible,
    tipo               = excluded.tipo,
    municipios         = excluded.municipios,
    contacto_publico   = excluded.contacto_publico,
    contacto_tipo      = excluded.contacto_tipo,
    descripcion        = excluded.descripcion,
    acepto_publicacion = excluded.acepto_publicacion,
    acepto_politica_at = now(),
    puede_trasladarse  = excluded.puede_trasladarse;

  if p_tipo = 'servidor' then
    if coalesce(trim(p_profesion), '') = ''
       or coalesce(trim(p_numero_matricula), '') = ''
       or p_entidad_matricula is null then
      raise exception 'Indica profesión, entidad y número de matrícula';
    end if;

    if exists (select 1 from public.servidores sv
                where sv.entidad_matricula = p_entidad_matricula
                  and sv.numero_matricula = trim(p_numero_matricula)
                  and sv.perfil_id <> v_uid) then
      raise exception 'Esa matrícula ya está registrada por otra persona';
    end if;

    if exists (select 1 from unnest(p_servicios) s
                where s not in (select c.id from public.catalogo_servicios c where c.activo)) then
      raise exception 'Servicio no válido';
    end if;

    insert into public.servidores (perfil_id, profesion, entidad_matricula, numero_matricula, servicios)
    values (v_uid, trim(p_profesion), p_entidad_matricula, trim(p_numero_matricula), p_servicios)
    on conflict (perfil_id) do update set
      profesion         = excluded.profesion,
      entidad_matricula = excluded.entidad_matricula,
      numero_matricula  = excluded.numero_matricula,
      servicios         = excluded.servicios;
  else
    delete from public.servidores where perfil_id = v_uid;
  end if;
end;
$$;

revoke execute on function public.crear_perfil(text,text,text[],text,text,text,text,text,text,text[],boolean)
  from public, anon;
grant  execute on function public.crear_perfil(text,text,text[],text,text,text,text,text,text,text[],boolean)
  to authenticated;

-- La firma vieja de 10 parámetros deja de existir: si quedara, una llamada
-- sin el booleano seguiría entrando por ella y el dato se perdería en
-- silencio, que es peor que un error.
drop function if exists public.crear_perfil(text,text,text[],text,text,text,text,text,text,text[]);

-- ---------------------------------------------------------------------
-- 3. Y lo confirma —o lo desdice— al responder
-- ---------------------------------------------------------------------

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

  insert into public.respuestas (solicitud_id, autor_id, mensaje, puede_llevar)
  values (v_solicitud_id, v_uid, trim(p_mensaje), coalesce(p_puede_llevar, false));

  return v_solicitud_id;
end;
$$;

revoke execute on function public.responder_solicitud(text,text,boolean) from public, anon;
grant  execute on function public.responder_solicitud(text,text,boolean) to authenticated;
drop function if exists public.responder_solicitud(text,text);

-- ---------------------------------------------------------------------
-- 4. Quien pide dice si puede ir a recoger
-- ---------------------------------------------------------------------

create or replace function public.crear_solicitud(
  p_municipio     text,
  p_barrio        text,
  p_categoria     text,
  p_nota          text,
  p_items         jsonb,
  p_token         text,
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

  return query select v_id, v_codigo;
end;
$$;

grant execute on function public.crear_solicitud(text,text,text,text,jsonb,text,boolean)
  to anon, authenticated;
drop function if exists public.crear_solicitud(text,text,text,text,jsonb,text);

-- ---------------------------------------------------------------------
-- 5. Quién ve cada cosa
-- ---------------------------------------------------------------------

-- Quien ofrece: público, junto al resto de su ficha. Es de alguien que ya
-- publica su contacto a propósito.
create or replace view public.ofertadores_publicos as
select
  p.id,
  p.nombre_visible,
  p.municipios,
  p.descripcion,
  p.creado_at,
  (select coalesce(jsonb_agg(x order by x->>'nombre'), '[]'::jsonb)
     from (
       select jsonb_build_object(
                'nombre',        coalesce(c.nombre, sg.nombre_propuesto),
                'por_confirmar', o.sugerencia_id is not null
              ) as x
         from public.ofrecimientos o
         left join public.catalogo_items c    on c.id = o.item_id
         left join public.sugerencias_item sg on sg.id = o.sugerencia_id
        where o.perfil_id = p.id and o.disponible
        order by coalesce(c.orden, 9999)
        limit 12
     ) t) as items,
  (select count(*) from public.ofrecimientos o
    where o.perfil_id = p.id and o.disponible) as total_items,
  -- Al final y no junto a `descripcion`, que es donde encajaría: `create or
  -- replace view` no deja meter una columna en medio, solo añadirla al
  -- final. Reordenarla exigiría un DROP, y de esta vista cuelgan otras.
  p.puede_trasladarse
from public.perfiles p
where p.suspendido = false
  and p.acepto_publicacion = true
  and (
    p.tipo = 'ofertador'
    or exists (select 1 from public.ofrecimientos o where o.perfil_id = p.id)
  );

grant select on public.ofertadores_publicos to anon, authenticated;

-- Quien pidió: ve lo suyo y quién de los que respondieron puede llevárselo.
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
           'profesion', sv.profesion, 'verificado', coalesce(sv.verificado, false),
           'puede_llevar', r.puede_llevar
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
    'puede_recoger', v_sol.puede_recoger,
    -- El NOMBRE de la organización, nunca su identificador ni nada de la
    -- identidad: los datos que entregó no se le vuelven a mostrar.
    'organizacion', (select o.nombre from public.organizaciones o
                      where o.id = v_sol.organizacion_id),
    'items', v_items, 'respuestas', v_resp
  );
end;
$$;

grant execute on function public.leer_solicitud(text) to anon, authenticated;

-- Y quien va a responder, que necesita saberlo justo antes de escribir.
--
-- RPC aparte y no una columna más en `solicitudes_publicas` porque esa
-- vista la lee `anon`: ahí el dato sería público y filtrable, que es
-- justo lo que no queremos. Aquí hace falta sesión y perfil vivo.
create or replace function public.movilidad_solicitud(p_codigo text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select s.puede_recoger
    from public.solicitudes s
   where s.codigo = upper(trim(p_codigo))
     and public.estado_activo(s.estado)
     and s.expira_at > now()
     and exists (select 1 from public.perfiles p
                  where p.id = auth.uid() and p.suspendido = false);
$$;

revoke execute on function public.movilidad_solicitud(text) from public, anon;
grant  execute on function public.movilidad_solicitud(text) to authenticated;

-- Lo que ya declaró en su perfil, para precargar la casilla al responder.
create or replace function public.mi_movilidad()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce((select p.puede_trasladarse from public.perfiles p
                    where p.id = auth.uid()), false);
$$;

revoke execute on function public.mi_movilidad() from public, anon;
grant  execute on function public.mi_movilidad() to authenticated;

-- Comprobar:
--   -- Que NO se filtró al tablero público:
--   select column_name from information_schema.columns
--    where table_name = 'solicitudes_publicas' and column_name = 'puede_recoger';
--   -- debe devolver cero filas.
--   select public.mi_movilidad();
