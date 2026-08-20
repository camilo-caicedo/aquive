-- =====================================================================
-- v3 · Fase S6 — Códigos de servicio y reseñas
--
-- Regla T: la reputación se gana con un servicio, no con una opinión.
-- Solo puede calificar quien tiene el código que el proveedor generó y
-- le entregó al terminar el trabajo. Un código sirve una vez y lo
-- garantiza el `unique` sobre `resenas.servicio_id`, no la interfaz.
--
-- Es lo que hace defendible tener reputación en un sitio que hasta ayer
-- decía que nunca la iba a tener: no es «cualquiera opina sobre
-- cualquiera», es «quien recibió un trabajo califica ese trabajo».
--
-- 🔴 El código NO va en ninguna URL (regla 6). Se escribe a mano en
-- /servicios/confirmar. No hay enlace, no hay QR y no hay path que lo
-- lleve: quien lo tiene lo recibió en papel o por WhatsApp del proveedor.
-- Por eso se guarda solo el hash, igual que un token.
--
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Normalizar el código
--
-- Se escribe a mano, en un teléfono, muchas veces por alguien que lo
-- está leyendo de un papel. Mayúsculas, minúsculas, espacios y guiones
-- tienen que dar lo mismo o el mecanismo entero no lo usa nadie.
-- ---------------------------------------------------------------------

create or replace function public.normalizar_codigo_servicio(p_codigo text)
returns text
language sql
immutable
as $$
  select upper(regexp_replace(coalesce(p_codigo, ''), '[^a-zA-Z0-9]', '', 'g'));
$$;

revoke execute on function public.normalizar_codigo_servicio(text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Generar un código
--
-- Ocho caracteres de un alfabeto sin I, O, 0 ni 1: es lo que se dicta por
-- teléfono y se copia de un papel, y esas cuatro son las que todo el
-- mundo confunde. 32^8 son 1,1 billones de combinaciones.
--
-- Se devuelve UNA vez, en claro. Después solo existe su hash, así que ni
-- el proveedor ni un administrador pueden recuperarlo: si se pierde, se
-- genera otro. Mismo trato que un token de solicitud, y por la misma
-- razón — quien tenga el código puede calificar.
-- ---------------------------------------------------------------------

create or replace function public.crear_codigo_servicio(
  p_oficio_id text default null,
  p_token     text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prov    uuid := public.proveedor_del_llamante(p_token);
  v_alfabeto text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_codigo  text;
  v_hash    text;
  v_intento integer := 0;
  v_i       integer;
begin
  if v_prov is null then
    raise exception 'No encontramos tu ficha';
  end if;

  if p_oficio_id is not null
     and not exists (select 1 from public.proveedor_oficios po
                      where po.proveedor_id = v_prov and po.oficio_id = p_oficio_id) then
    raise exception 'Ese oficio no está en tu ficha';
  end if;

  -- Diez códigos sin usar es mucho más de lo que nadie necesita al mismo
  -- tiempo, y evita que alguien fabrique cien para repartirlos.
  if (select count(*) from public.servicios_prestados s
       where s.proveedor_id = v_prov
         and s.confirmado_at is null
         and s.expira_at > now()) >= 10 then
    raise exception 'Tienes 10 códigos sin usar. Espera a que los usen o a que venzan.';
  end if;

  loop
    v_intento := v_intento + 1;
    v_codigo := '';
    for v_i in 1..8 loop
      v_codigo := v_codigo ||
        substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::integer, 1);
    end loop;
    v_hash := encode(extensions.digest(v_codigo, 'sha256'), 'hex');
    exit when not exists (
      select 1 from public.servicios_prestados s where s.codigo_hash = v_hash);
    if v_intento > 20 then
      raise exception 'No se pudo generar el código';
    end if;
  end loop;

  insert into public.servicios_prestados (proveedor_id, oficio_id, codigo_hash)
  values (v_prov, p_oficio_id, v_hash);

  return v_codigo;
end;
$$;

revoke execute on function public.crear_codigo_servicio(text,text) from public;
grant  execute on function public.crear_codigo_servicio(text,text) to anon, authenticated;

comment on function public.crear_codigo_servicio(text,text) is
  'Regla T. Devuelve el código EN CLARO una sola vez; después solo existe su sha256. Nadie puede recuperarlo, ni el proveedor ni un administrador: si se pierde, se genera otro.';

-- ---------------------------------------------------------------------
-- 3. Confirmar y calificar, en una sola transacción
--
-- Los tres criterios entran como `integer` y se convierten adentro. La
-- columna es `smallint`, pero ni plpgsql ni PostgREST mandan smallint sin
-- que quien llama escriba el cast a mano, y una firma que obliga a eso es
-- una firma que se llama mal.
--
-- Las dos cosas juntas a propósito: un código «confirmado» sin reseña
-- dejaría al cliente sin poder calificar y al proveedor con un servicio
-- confirmado gratis. O pasan las dos o no pasa ninguna.
--
-- Sin `grant` a `anon`: la llama /api/servicios/confirmar con la llave de
-- servicio, después del Turnstile. El código es imposible de adivinar,
-- pero sin anti-spam nada impide intentarlo un millón de veces.
-- ---------------------------------------------------------------------

create or replace function public.confirmar_y_resenar(
  p_codigo       text,
  p_cumplimiento integer,
  p_trato        integer,
  p_puntualidad  integer,
  p_comentario   text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_serv public.servicios_prestados;
  v_com  text := nullif(trim(coalesce(p_comentario, '')), '');
  v_prov public.proveedores;
begin
  select * into v_serv
  from public.servicios_prestados
  where codigo_hash = encode(
    extensions.digest(public.normalizar_codigo_servicio(p_codigo), 'sha256'), 'hex');

  if not found then
    raise exception 'Ese código no existe. Revísalo con quien te hizo el trabajo.';
  end if;

  if v_serv.confirmado_at is not null then
    raise exception 'Ese código ya se usó. Cada uno sirve una sola vez.';
  end if;

  if v_serv.expira_at <= now() then
    raise exception 'Ese código venció. Pídele uno nuevo a quien te hizo el trabajo.';
  end if;

  if p_cumplimiento not between 1 and 3
     or p_trato not between 1 and 3
     or p_puntualidad not between 1 and 3 then
    raise exception 'Falta calificar los tres puntos';
  end if;

  if v_com is not null then
    if char_length(v_com) > 140 then
      raise exception 'El comentario no puede pasar de 140 caracteres';
    end if;
    -- Regla 2: es texto libre sobre una persona identificada, así que va
    -- con el mismo filtro que la nota de una solicitud.
    if public.contiene_pii(v_com) then
      raise exception 'El comentario no puede llevar teléfonos ni correos';
    end if;
  end if;

  select * into v_prov from public.proveedores where id = v_serv.proveedor_id;

  update public.servicios_prestados
     set confirmado_at = now()
   where id = v_serv.id;

  insert into public.resenas (
    servicio_id, proveedor_id, cumplimiento, trato, puntualidad,
    comentario, es_prueba)
  values (
    v_serv.id, v_serv.proveedor_id,
    p_cumplimiento::smallint, p_trato::smallint, p_puntualidad::smallint,
    v_com, v_serv.es_prueba);

  return jsonb_build_object(
    'ok', true,
    'proveedor_id', v_prov.id,
    'proveedor_nombre', v_prov.nombre_visible);
end;
$$;

revoke execute on function public.confirmar_y_resenar(text,integer,integer,integer,text)
  from public, anon, authenticated;

comment on function public.confirmar_y_resenar(text,integer,integer,integer,text) is
  'Regla T. Confirma el servicio y crea la reseña en la misma transacción: un código confirmado sin reseña dejaría al cliente sin poder calificar. Sin grant a anon — la llama el route handler tras el Turnstile.';

-- ---------------------------------------------------------------------
-- 4. Lo que ve el proveedor
--
-- Sus códigos —sin el código, que ya no existe— y sus reseñas, para
-- poder responderlas.
-- ---------------------------------------------------------------------

create or replace function public.mis_servicios(p_token text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_prov uuid := public.proveedor_del_llamante(p_token);
begin
  if v_prov is null then
    return jsonb_build_object('codigos', '[]'::jsonb, 'resenas', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'codigos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'oficio_nombre', c.nombre,
        'creado_at', s.creado_at,
        'expira_at', s.expira_at,
        'confirmado_at', s.confirmado_at
      ) order by s.creado_at desc)
      from public.servicios_prestados s
      left join public.catalogo_oficios c on c.id = s.oficio_id
      where s.proveedor_id = v_prov), '[]'::jsonb),
    'resenas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'cumplimiento', r.cumplimiento,
        'trato', r.trato,
        'puntualidad', r.puntualidad,
        'comentario', r.comentario,
        'replica', r.replica,
        'oculta', r.oculta,
        'creada_at', r.creada_at
      ) order by r.creada_at desc)
      from public.resenas r
      where r.proveedor_id = v_prov), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.mis_servicios(text) from public;
grant  execute on function public.mis_servicios(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Derecho de réplica
--
-- El §6 del documento fuente lo pide, y es lo que evita que una reseña
-- injusta sea la última palabra. Una sola vez y de 140, como el
-- comentario: si la réplica pudiera ser más larga que la reseña, la
-- ficha se convierte en un juzgado.
-- ---------------------------------------------------------------------

create or replace function public.responder_resena(
  p_resena_id uuid,
  p_replica   text,
  p_token     text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prov uuid := public.proveedor_del_llamante(p_token);
  v_rep  text := nullif(trim(coalesce(p_replica, '')), '');
begin
  if v_prov is null then
    raise exception 'No encontramos tu ficha';
  end if;

  if not exists (select 1 from public.resenas r
                  where r.id = p_resena_id and r.proveedor_id = v_prov) then
    raise exception 'Esa calificación no es de tu ficha';
  end if;

  if v_rep is null then
    raise exception 'Escribe tu respuesta';
  end if;
  if char_length(v_rep) > 140 then
    raise exception 'La respuesta no puede pasar de 140 caracteres';
  end if;
  if public.contiene_pii(v_rep) then
    raise exception 'La respuesta no puede llevar teléfonos ni correos';
  end if;

  update public.resenas
     set replica = v_rep, replica_at = now()
   where id = p_resena_id;
end;
$$;

revoke execute on function public.responder_resena(uuid,text,text) from public;
grant  execute on function public.responder_resena(uuid,text,text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Moderación de una reseña
--
-- `oculta` es reversible y NO es borrado lógico: la reseña no es un dato
-- personal de quien la escribió, y la moderación necesita poder quitarla
-- sin destruir la evidencia mientras se revisa el reporte. Un reporte por
-- extorsión que se confirma termina en `borrar_resena`, que sí borra.
-- ---------------------------------------------------------------------

create or replace function public.ocultar_resena(
  p_resena_id uuid,
  p_oculta    boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;
  update public.resenas set oculta = p_oculta where id = p_resena_id;
end;
$$;

revoke execute on function public.ocultar_resena(uuid,boolean) from public, anon;
grant  execute on function public.ocultar_resena(uuid,boolean) to authenticated;

create or replace function public.borrar_resena(p_resena_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;
  delete from public.resenas where id = p_resena_id;
end;
$$;

revoke execute on function public.borrar_resena(uuid) from public, anon;
grant  execute on function public.borrar_resena(uuid) to authenticated;

comment on function public.borrar_resena(uuid) is
  'Borrado real, para cuando un reporte por extorsión o discriminación se confirma. El servicio confirmado se queda: ocurrió.';
