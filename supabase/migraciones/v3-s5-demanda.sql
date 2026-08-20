-- =====================================================================
-- v3 · Fase S5 — El lado de la demanda
--
-- Quien necesita un servicio publica QUÉ necesita, no quién es. La regla
-- 1 aplica entera y sin excepción: oficio, municipio, zona, urgencia,
-- capacidad de pago y una nota de 140 filtrada. Nada más.
--
-- Token portador, igual que las solicitudes de emergencia: se genera en
-- el servidor de Next, se guarda solo el hash y se muestra una vez.
--
-- Quince días y no 72 horas. Conseguir una modista no es conseguir agua,
-- y una solicitud que se borra antes de que nadie alcance a verla no
-- ayuda a nadie. Sigue siendo borrado duro, y `expirar_servicios()` —de
-- la Fase S1— ya la borra y deja su fila anónima en `metricas_servicio`.
--
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Publicar
--
-- Devuelve el código, como `crear_solicitud`. El token entra en claro y
-- se guarda hasheado: esta función nunca lo devuelve, porque quien la
-- llama ya lo tiene.
-- ---------------------------------------------------------------------

create or replace function public.crear_solicitud_servicio(
  p_oficio_id      text,
  p_municipio      text,
  p_zona_id        uuid,
  p_zona_texto     text,
  p_urgencia       text,
  p_capacidad_pago text,
  p_nota           text,
  p_token          text
)
returns table (solicitud_id uuid, codigo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text;
  v_zona   text := nullif(trim(coalesce(p_zona_texto, '')), '');
  v_nota   text := nullif(trim(coalesce(p_nota, '')), '');
  v_id     uuid;
  v_intento integer := 0;
begin
  if not exists (select 1 from public.catalogo_oficios c
                  where c.id = p_oficio_id and c.activo) then
    raise exception 'Oficio no válido';
  end if;

  if not exists (select 1 from public.municipios m where m.codigo_dane = p_municipio) then
    raise exception 'Municipio inválido';
  end if;

  if p_zona_id is not null and v_zona is not null then
    raise exception 'Elige la zona de la lista o escríbela, no las dos';
  end if;

  if p_zona_id is not null
     and not exists (select 1 from public.zonas z
                      where z.id = p_zona_id and z.activa and z.municipio = p_municipio) then
    raise exception 'Esa zona no es de ese municipio';
  end if;

  if v_zona is not null then
    if char_length(v_zona) < 2 or char_length(v_zona) > 60 then
      raise exception 'La zona debe tener entre 2 y 60 caracteres';
    end if;
    if public.contiene_pii(v_zona) then
      raise exception 'La zona no puede llevar teléfonos ni correos';
    end if;
  end if;

  if p_urgencia not in ('hoy','esta_semana','sin_prisa') then
    raise exception 'Urgencia inválida';
  end if;
  if p_capacidad_pago not in ('puedo_pagar','pago_poco','no_puedo_pagar') then
    raise exception 'Opción de pago inválida';
  end if;

  if v_nota is not null then
    if char_length(v_nota) > 140 then
      raise exception 'La nota no puede pasar de 140 caracteres';
    end if;
    -- Regla 1 y regla 2: es el único texto libre de esta tabla y es por
    -- donde se colaría un teléfono, que es justo lo que no se guarda de
    -- quien pide.
    if public.contiene_pii(v_nota) then
      raise exception 'La nota no puede llevar teléfonos ni correos. Quien te responda te va a dejar el suyo.';
    end if;
  end if;

  if coalesce(char_length(trim(p_token)), 0) < 20 then
    raise exception 'Token inválido';
  end if;

  -- Código corto y legible, como el de las solicitudes de emergencia. Se
  -- reintenta ante una colisión en vez de confiar en la suerte: cuatro
  -- caracteres son 1,3 millones de combinaciones, y con unos miles de
  -- filas vivas el cumpleaños pega.
  loop
    v_intento := v_intento + 1;
    v_codigo := upper(substring(encode(extensions.gen_random_bytes(8), 'hex') from 1 for 4));
    exit when not exists (
      select 1 from public.solicitudes_servicio s where s.codigo = v_codigo);
    if v_intento > 20 then
      raise exception 'No se pudo generar el código';
    end if;
  end loop;

  insert into public.solicitudes_servicio (
    codigo, token_hash, oficio_id, municipio, zona_id, zona_texto,
    urgencia, capacidad_pago, nota)
  values (
    v_codigo,
    encode(extensions.digest(p_token, 'sha256'), 'hex'),
    p_oficio_id, p_municipio, p_zona_id, v_zona,
    p_urgencia, p_capacidad_pago, v_nota)
  returning id into v_id;

  return query select v_id, v_codigo;
end;
$$;

revoke execute on function public.crear_solicitud_servicio(
  text,text,uuid,text,text,text,text,text) from public, anon, authenticated;

comment on function public.crear_solicitud_servicio(
  text,text,uuid,text,text,text,text,text) is
  'La llama el servidor de Next con la llave de servicio, como crear_solicitud: el token lo genera allá. Sin grant a anon, para que el token no pueda entrar desde el navegador sin pasar por el Turnstile.';

-- ---------------------------------------------------------------------
-- 2. Leer la propia solicitud, con el token
--
-- Trae las respuestas con el contacto de quien respondió, que es lo
-- único que hace falta: quien pidió decide a quién escribir y lo hace
-- por fuera. La plataforma no sabe nada de esa conversación.
-- ---------------------------------------------------------------------

create or replace function public.leer_solicitud_servicio(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'codigo', s.codigo,
    'oficio_id', s.oficio_id,
    'oficio_nombre', c.nombre,
    'municipio', s.municipio,
    'zona_nombre', z.nombre,
    'zona_texto', s.zona_texto,
    'urgencia', s.urgencia,
    'capacidad_pago', s.capacidad_pago,
    'nota', s.nota,
    'estado', s.estado,
    'creada_at', s.creada_at,
    'expira_at', s.expira_at,
    'respuestas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id,
               'mensaje', r.mensaje,
               'creada_at', r.creada_at,
               'proveedor_id', p.id,
               'proveedor_nombre', p.nombre_visible,
               'telefono', p.telefono,
               'telefono_verificado', p.telefono_verificado,
               'servicios_confirmados', p.servicios_confirmados,
               'referencias_confirmadas', p.referencias_confirmadas
             ) order by r.creada_at desc)
      from public.respuestas_servicio r
      -- Contra la vista, no contra la tabla: si a quien respondió lo
      -- suspendieron después, su respuesta deja de mostrarse.
      join public.proveedores_publicos p on p.id = r.proveedor_id
      where r.solicitud_id = s.id), '[]'::jsonb)
  )
  from public.solicitudes_servicio s
  join public.catalogo_oficios c on c.id = s.oficio_id
  left join public.zonas z on z.id = s.zona_id
  where s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

grant execute on function public.leer_solicitud_servicio(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Renovar, resolver, borrar
--
-- Las tres con el token y nada más. Borrar es DELETE real y deja su fila
-- anónima en `metricas_servicio`, igual que hace la expiración: si el
-- borrado manual no la dejara, resolver a mano borraría la estadística
-- de lo que sí funcionó.
-- ---------------------------------------------------------------------

create or replace function public.gestionar_solicitud_servicio(
  p_token  text,
  p_accion text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sol public.solicitudes_servicio;
begin
  if p_accion not in ('renovar','resolver','borrar') then
    raise exception 'Acción inválida';
  end if;

  select * into v_sol from public.solicitudes_servicio
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  if not found then
    raise exception 'No encontramos esa solicitud';
  end if;

  if p_accion = 'renovar' then
    update public.solicitudes_servicio
       set expira_at = now() + interval '15 days'
     where id = v_sol.id;
    return jsonb_build_object('ok', true, 'expira_at', now() + interval '15 days');
  end if;

  if p_accion = 'resolver' then
    update public.solicitudes_servicio
       set estado = 'resuelta'
     where id = v_sol.id;
    return jsonb_build_object('ok', true, 'estado', 'resuelta');
  end if;

  insert into public.metricas_servicio (
    municipio, oficio, grupo, hubo_respuesta, hubo_confirmacion,
    horas_hasta_respuesta, es_prueba)
  select v_sol.municipio, v_sol.oficio_id, c.grupo,
         exists (select 1 from public.respuestas_servicio r
                  where r.solicitud_id = v_sol.id),
         v_sol.estado = 'resuelta',
         (select round(extract(epoch from (min(r.creada_at) - v_sol.creada_at)) / 3600.0, 1)
            from public.respuestas_servicio r where r.solicitud_id = v_sol.id),
         v_sol.es_prueba
  from public.catalogo_oficios c where c.id = v_sol.oficio_id;

  delete from public.solicitudes_servicio where id = v_sol.id;
  return jsonb_build_object('ok', true, 'borrada', true);
end;
$$;

grant execute on function public.gestionar_solicitud_servicio(text,text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Responder
--
-- Solo un proveedor publicado, y una sola vez por solicitud. El mensaje
-- pasa por `contiene_pii`: su teléfono ya está en su ficha y en la
-- pantalla de quien pidió, así que repetirlo aquí no aporta y sí abre un
-- hueco por donde meter otra cosa.
-- ---------------------------------------------------------------------

create or replace function public.responder_servicio(
  p_solicitud_id uuid,
  p_mensaje      text,
  p_token        text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prov uuid := public.proveedor_del_llamante(p_token);
  v_msg  text := trim(coalesce(p_mensaje, ''));
begin
  if v_prov is null then
    raise exception 'Necesitas una ficha en el directorio para responder';
  end if;

  -- Contra la vista: quien está suspendido, o a quien la regla S le
  -- escondió todos sus oficios, no aparece en el directorio y tampoco
  -- puede responder. Sería la puerta de atrás al mismo sitio.
  if not exists (select 1 from public.proveedores_publicos p where p.id = v_prov) then
    raise exception 'Tu ficha no está publicada, así que todavía no puedes responder';
  end if;

  if not exists (select 1 from public.solicitudes_servicio s
                  where s.id = p_solicitud_id
                    and s.estado = 'abierta'
                    and s.expira_at > now()) then
    raise exception 'Esa solicitud ya no está abierta';
  end if;

  if char_length(v_msg) < 10 or char_length(v_msg) > 200 then
    raise exception 'El mensaje debe tener entre 10 y 200 caracteres';
  end if;
  if public.contiene_pii(v_msg) then
    raise exception 'No pongas tu teléfono aquí: ya sale en tu ficha, y esa persona lo va a ver.';
  end if;

  insert into public.respuestas_servicio (solicitud_id, proveedor_id, mensaje)
  values (p_solicitud_id, v_prov, v_msg)
  on conflict (solicitud_id, proveedor_id) do update set
    mensaje = excluded.mensaje,
    creada_at = now();
end;
$$;

revoke execute on function public.responder_servicio(uuid,text,text) from public;
grant  execute on function public.responder_servicio(uuid,text,text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. El tablero, para quien ofrece
--
-- Ordenado por urgencia y por antigüedad. Trae si el proveedor que mira
-- ya respondió, para no ofrecerle un botón que va a rebotar.
--
-- `capacidad_pago` sale aquí porque quien ofrece necesita saber si le
-- están pidiendo trabajo gratis antes de escribir. Lo que NO existe es
-- un filtro por esa columna: un tablero listable por ahí sería un
-- directorio de a quién le alcanza menos.
-- ---------------------------------------------------------------------

create or replace function public.solicitudes_de_servicio(
  p_municipio text default null,
  p_oficio_id text default null,
  p_token     text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_prov uuid := public.proveedor_del_llamante(p_token);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'codigo', s.codigo,
      'oficio_id', s.oficio_id,
      'oficio_nombre', s.oficio_nombre,
      'grupo', s.grupo,
      'municipio', s.municipio,
      'zona_nombre', s.zona_nombre,
      'zona_texto', s.zona_texto,
      'urgencia', s.urgencia,
      'capacidad_pago', s.capacidad_pago,
      'nota', s.nota,
      'creada_at', s.creada_at,
      'num_respuestas', s.num_respuestas,
      'ya_respondi', v_prov is not null and exists (
        select 1 from public.respuestas_servicio r
         where r.solicitud_id = s.id and r.proveedor_id = v_prov)
    ) order by
        case s.urgencia when 'hoy' then 0 when 'esta_semana' then 1 else 2 end,
        s.creada_at desc)
    from public.solicitudes_servicio_publicas s
    where (p_municipio is null or s.municipio = p_municipio)
      and (p_oficio_id is null or s.oficio_id = p_oficio_id)
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.solicitudes_de_servicio(text,text,text) to anon, authenticated;
