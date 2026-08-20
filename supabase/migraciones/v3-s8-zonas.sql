-- =====================================================================
-- v3 · Fase S8 — Comuna y zona a la vez, y las zonas que propone la gente
--
-- Dos arreglos de lo que S1 dejó mal planteado.
--
-- 1. `zona_id` y `zona_texto` eran excluyentes —«una u otra, o ninguna»—
--    y en Cali lo natural es decir las dos: «Comuna 3, San Nicolás». Y
--    dejar las dos vacías producía una ficha sin ubicación dentro del
--    municipio, que para un directorio de servicios a domicilio no sirve.
--    Ahora conviven y hace falta **al menos una**.
--
--    La columna sigue llamándose `zona_texto` a propósito: «barrio»
--    cerraría las opciones a una sola división y hay municipios donde lo
--    que la gente dice es la vereda, el corregimiento o el sector. Lo que
--    cambia según el municipio es la ETIQUETA en pantalla, no el dato.
--
-- 2. Solo Cali tiene comunas sembradas, así que en los demás municipios
--    ese texto se quedaba suelto y nadie podía filtrar por él. Ahora se
--    **propone** como zona: entra en `zonas` con estado `propuesta`, un
--    administrador o el equipo de la fundación la aprueba, y desde
--    entonces sale en el desplegable de ese municipio. El directorio lo
--    construye quien lo usa, en vez de esperar a que alguien siembre
--    1.121 municipios a mano.
--
-- La propuesta NO es una RPC pública nueva: ocurre como efecto de
-- guardar, dentro de las funciones que ya validan y que ya exigen sesión,
-- token o Turnstile. Una puerta menos que vigilar.
--
-- No renombra ni borra nada. Las vistas y las RPC de lectura siguen
-- igual.
--
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. `zonas` aprende a estar pendiente
--
-- Lo sembrado nace aprobado; lo que propone la gente, no. El estado
-- `rechazada` existe para que un nombre descartado no vuelva a la cola
-- cada vez que alguien lo escriba: el `unique` sobre (municipio, nombre)
-- lo bloquea, y así el administrador no lo ve reaparecer para siempre.
-- ---------------------------------------------------------------------

alter table public.zonas
  add column if not exists estado text not null default 'aprobada';

alter table public.zonas drop constraint if exists zonas_estado_check;
alter table public.zonas add  constraint zonas_estado_check
  check (estado in ('propuesta','aprobada','rechazada'));

alter table public.zonas
  add column if not exists creada_at timestamptz not null default now();
alter table public.zonas
  add column if not exists revisada_por uuid references auth.users(id) on delete set null;
alter table public.zonas
  add column if not exists revisada_at timestamptz;

comment on column public.zonas.estado is
  'Lo sembrado nace `aprobada`. Lo que escribe alguien al publicar su ficha o su solicitud entra como `propuesta` y no sale en ningún desplegable hasta que se apruebe.';

-- La lectura pública solo ve lo aprobado. Una zona propuesta existe para
-- quien la revisa y para nadie más: si saliera en el desplegable, el
-- primer error de dedo se volvería una opción oficial.
drop policy if exists "zonas lectura publica" on public.zonas;
create policy "zonas lectura publica" on public.zonas
  for select to public using (activa = true and estado = 'aprobada');

create index if not exists idx_zonas_propuestas
  on public.zonas(creada_at) where estado = 'propuesta';

-- ---------------------------------------------------------------------
-- 2. Al menos una de las dos
--
-- Ya no «como máximo una». En Cali lo normal es decir la comuna Y el
-- sector; en el resto, solo el texto.
-- ---------------------------------------------------------------------

alter table public.proveedores drop constraint if exists proveedores_una_zona;
alter table public.proveedores drop constraint if exists proveedores_tiene_zona;
alter table public.proveedores add  constraint proveedores_tiene_zona
  check (num_nonnulls(zona_id, zona_texto) >= 1);

alter table public.solicitudes_servicio
  drop constraint if exists solicitudes_servicio_una_zona;
alter table public.solicitudes_servicio
  drop constraint if exists solicitudes_servicio_tiene_zona;
alter table public.solicitudes_servicio
  add  constraint solicitudes_servicio_tiene_zona
  check (num_nonnulls(zona_id, zona_texto) >= 1);

comment on column public.proveedores.zona_texto is
  'La zona escrita a mano: barrio, vereda, sector o lo que se diga en ese municipio. Texto libre con tope y filtro de PII, como `solicitudes.barrio`. Convive con `zona_id`. Al guardar se propone como zona del municipio.';

-- ---------------------------------------------------------------------
-- 3. Proponer una zona
--
-- Interna: la llaman `guardar_proveedor`, `crear_proveedor_asistido` y
-- `crear_solicitud_servicio`. No se expone, para no abrir una puerta que
-- haya que defender del spam por separado.
--
-- `on conflict do nothing`: si ese nombre ya existe en el municipio
-- —aprobado, propuesto o rechazado— no se toca.
-- ---------------------------------------------------------------------

create or replace function public.proponer_zona(
  p_municipio text,
  p_nombre    text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text := trim(coalesce(p_nombre, ''));
begin
  if char_length(v_nombre) < 2 or char_length(v_nombre) > 60 then
    return;
  end if;

  -- Solo donde NO hay desplegable todavía.
  --
  -- En Cali hay 22 comunas y unos 340 barrios: proponer cada barrio que
  -- alguien escriba ahogaría la cola en trabajo que no sirve para nada,
  -- porque la división que se elige de la lista ya existe. La propuesta
  -- es para los municipios que aún no tienen ninguna, que es donde el
  -- desplegable está vacío y hay algo que construir.
  if exists (
    select 1 from public.zonas z
    where z.municipio = p_municipio
      and z.activa
      and z.estado = 'aprobada'
      and z.tipo in ('comuna','corregimiento')
  ) then
    return;
  end if;

  -- `barrio` como tipo por defecto porque es lo que más se escribe. Quien
  -- aprueba puede corregirlo a comuna o corregimiento en el mismo paso.
  insert into public.zonas (municipio, nombre, tipo, estado, orden)
  values (p_municipio, v_nombre, 'barrio', 'propuesta', 100)
  on conflict (municipio, nombre) do nothing;
end;
$$;

revoke execute on function public.proponer_zona(text,text)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Resolver una propuesta
--
-- La puede el administrador y el equipo de una organización aliada: son
-- quienes conocen el territorio, y hacerlos esperar a que un
-- administrador se despierte para que un barrio de Jamundí salga en un
-- desplegable es dejarlos sin la herramienta.
--
-- Al aprobar se puede corregir el nombre y el tipo, que es casi siempre
-- lo que hace falta: llega mal escrito, o llega una comuna marcada como
-- barrio.
-- ---------------------------------------------------------------------

create or replace function public.resolver_zona(
  p_id      uuid,
  p_aprobar boolean,
  p_nombre  text default null,
  p_tipo    text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombre text := nullif(trim(coalesce(p_nombre, '')), '');
begin
  if not public.es_admin(auth.uid())
     and public.mi_organizacion_activa() is null then
    raise exception 'No autorizado';
  end if;

  if not exists (select 1 from public.zonas z where z.id = p_id) then
    raise exception 'Esa zona no existe';
  end if;

  if v_nombre is not null
     and (char_length(v_nombre) < 2 or char_length(v_nombre) > 60) then
    raise exception 'El nombre debe tener entre 2 y 60 caracteres';
  end if;

  if p_tipo is not null and p_tipo not in ('comuna','corregimiento','barrio') then
    raise exception 'Tipo de zona inválido';
  end if;

  update public.zonas
     set estado = case when p_aprobar then 'aprobada' else 'rechazada' end,
         nombre = coalesce(v_nombre, nombre),
         tipo   = coalesce(p_tipo, tipo),
         revisada_por = auth.uid(),
         revisada_at  = now()
   where id = p_id;
end;
$$;

revoke execute on function public.resolver_zona(uuid,boolean,text,text) from public, anon;
grant  execute on function public.resolver_zona(uuid,boolean,text,text) to authenticated;

create or replace function public.zonas_propuestas()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_admin(auth.uid())
     and public.mi_organizacion_activa() is null then
    raise exception 'No autorizado';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', z.id,
      'municipio', z.municipio,
      'municipio_nombre', m.nombre,
      'departamento', m.departamento,
      'nombre', z.nombre,
      'tipo', z.tipo,
      'creada_at', z.creada_at,
      -- Cuánta gente la escribió. Una zona que aparece tres veces es más
      -- probable que exista que una que aparece una sola.
      'usos', (
        select count(*) from public.proveedores p
         where p.municipio = z.municipio and lower(p.zona_texto) = lower(z.nombre))
             + (
        select count(*) from public.solicitudes_servicio s
         where s.municipio = z.municipio and lower(s.zona_texto) = lower(z.nombre))
    ) order by z.creada_at)
    from public.zonas z
    join public.municipios m on m.codigo_dane = z.municipio
    where z.estado = 'propuesta'
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.zonas_propuestas() from public, anon;
grant  execute on function public.zonas_propuestas() to authenticated;

-- ---------------------------------------------------------------------
-- 5. Las tres RPC que escriben una zona
--
-- Cambian en tres cosas: aceptan las dos a la vez, exigen al menos una,
-- y proponen el texto como zona del municipio. Se redefinen enteras
-- porque plpgsql no admite parches; la firma no cambia, así que no hay
-- que tirar nada.
-- ---------------------------------------------------------------------

create or replace function public.guardar_proveedor(
  p_nombre_visible       text,
  p_tipo                 text,
  p_telefono             text,
  p_municipio            text,
  p_zona_id              uuid,
  p_zona_texto           text,
  p_modalidad            text[],
  p_dias                 text[],
  p_franjas              text[],
  p_medios_pago          text[],
  p_descripcion          text,
  p_oficios              jsonb,
  p_acepto_publicacion   boolean,
  p_autorizacion_version text,
  p_token                text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id       uuid := public.proveedor_del_llamante(p_token);
  v_uid      uuid := auth.uid();
  v_nombre   text := trim(coalesce(p_nombre_visible, ''));
  v_telefono text := trim(coalesce(p_telefono, ''));
  v_zona     text := nullif(trim(coalesce(p_zona_texto, '')), '');
  v_desc     text := nullif(trim(coalesce(p_descripcion, '')), '');
  v_n        integer;
begin
  if p_token is not null and v_id is null then
    raise exception 'Ese enlace no corresponde a ninguna ficha';
  end if;
  if p_token is null and v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if p_acepto_publicacion is not true then
    raise exception 'Tienes que autorizar la publicación de tus datos';
  end if;
  if char_length(trim(coalesce(p_autorizacion_version, ''))) < 3 then
    raise exception 'Falta la versión del texto de autorización';
  end if;

  if char_length(v_nombre) < 3 or char_length(v_nombre) > 60 then
    raise exception 'El nombre debe tener entre 3 y 60 caracteres';
  end if;
  if public.contiene_pii(v_nombre) then
    raise exception 'El nombre no puede llevar teléfonos ni correos';
  end if;

  if p_tipo not in ('persona','microempresa') then
    raise exception 'Tipo inválido';
  end if;

  if v_telefono !~ '^[0-9+()\- ]{7,20}$' then
    raise exception 'Revisa el teléfono: solo números, espacios y los signos + ( ) -';
  end if;

  if not exists (select 1 from public.municipios m where m.codigo_dane = p_municipio) then
    raise exception 'Municipio inválido';
  end if;

  -- Conviven: la comuna es la división gruesa y el texto la fina. Lo que
  -- no puede pasar es que no haya ninguna de las dos.
  if p_zona_id is null and v_zona is null then
    raise exception 'Di al menos la comuna o el barrio donde trabajas';
  end if;

  if p_zona_id is not null
     and not exists (select 1 from public.zonas z
                      where z.id = p_zona_id and z.activa and z.estado = 'aprobada'
                        and z.municipio = p_municipio) then
    raise exception 'Esa zona no es de ese municipio';
  end if;

  if v_zona is not null then
    if public.contiene_pii(v_zona) then
      raise exception 'El barrio no puede llevar teléfonos ni correos';
    end if;
    if char_length(v_zona) < 2 or char_length(v_zona) > 60 then
      raise exception 'El barrio debe tener entre 2 y 60 caracteres';
    end if;
  end if;

  if coalesce(array_length(p_modalidad, 1), 0) = 0 then
    raise exception 'Di si atiendes a domicilio, en tu local o a distancia';
  end if;
  if not (p_modalidad <@ array['domicilio','local','remoto']) then
    raise exception 'Modalidad inválida';
  end if;
  if not (coalesce(p_dias, '{}') <@ array['lun','mar','mie','jue','vie','sab','dom']) then
    raise exception 'Día inválido';
  end if;
  if not (coalesce(p_franjas, '{}') <@ array['manana','tarde','noche']) then
    raise exception 'Franja horaria inválida';
  end if;
  if not (coalesce(p_medios_pago, '{}') <@ array['efectivo','nequi','daviplata']) then
    raise exception 'Medio de pago inválido';
  end if;

  if v_desc is not null then
    if char_length(v_desc) > 300 then
      raise exception 'La descripción no puede pasar de 300 caracteres';
    end if;
    if public.contiene_pii(v_desc) then
      raise exception 'La descripción no puede llevar teléfonos ni correos: tu número ya sale en tu ficha';
    end if;
  end if;

  v_n := jsonb_array_length(coalesce(p_oficios, '[]'::jsonb));
  if v_n = 0 then
    raise exception 'Elige al menos un oficio';
  end if;
  if v_n > 8 then
    raise exception 'Elige máximo 8 oficios';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_oficios) o
    where not exists (select 1 from public.catalogo_oficios c
                       where c.id = o->>'oficio_id' and c.activo)
  ) then
    raise exception 'Oficio no válido';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_oficios) o
    where coalesce(o->>'modo', '') not in ('gratis','aporte','solidario','normal')
  ) then
    raise exception 'Modo de precio inválido';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_oficios) o
    where o->>'modo' in ('solidario','normal')
      and nullif(o->>'precio_desde', '') is not null
      and coalesce(o->>'unidad', '') not in
          ('hora','trabajo','dia','prenda','viaje','plato','unidad')
  ) then
    raise exception 'Si pones un precio, di de qué: por hora, por trabajo, por prenda…';
  end if;

  if v_id is null then
    insert into public.proveedores (
      perfil_id, nombre_visible, tipo, telefono, municipio, zona_id,
      zona_texto, modalidad, dias, franjas, medios_pago, descripcion,
      acepto_publicacion, autorizacion_version, autorizacion_at)
    values (
      v_uid, v_nombre, p_tipo, v_telefono, p_municipio, p_zona_id,
      v_zona, p_modalidad, coalesce(p_dias, '{}'), coalesce(p_franjas, '{}'),
      coalesce(p_medios_pago, '{}'), v_desc,
      true, trim(p_autorizacion_version), now())
    returning id into v_id;
  else
    update public.proveedores set
      nombre_visible = v_nombre,
      tipo           = p_tipo,
      telefono_verificado = case when telefono = v_telefono then telefono_verificado else false end,
      verificado_at       = case when telefono = v_telefono then verificado_at else null end,
      verificado_por      = case when telefono = v_telefono then verificado_por else null end,
      telefono       = v_telefono,
      municipio      = p_municipio,
      zona_id        = p_zona_id,
      zona_texto     = v_zona,
      modalidad      = p_modalidad,
      dias           = coalesce(p_dias, '{}'),
      franjas        = coalesce(p_franjas, '{}'),
      medios_pago    = coalesce(p_medios_pago, '{}'),
      descripcion    = v_desc,
      acepto_publicacion   = true,
      autorizacion_version = trim(p_autorizacion_version),
      autorizacion_at      = now(),
      actualizado_at       = now()
    where id = v_id;
  end if;

  delete from public.proveedor_oficios where proveedor_id = v_id;

  insert into public.proveedor_oficios (proveedor_id, oficio_id, modo, precio_desde, unidad)
  select v_id,
         o->>'oficio_id',
         o->>'modo',
         case when o->>'modo' in ('solidario','normal')
              then nullif(o->>'precio_desde', '')::numeric end,
         case when o->>'modo' in ('solidario','normal')
               and nullif(o->>'precio_desde', '') is not null
              then o->>'unidad' end
  from jsonb_array_elements(p_oficios) o;

  -- La zona escrita a mano se propone. Así el desplegable de Jamundí lo
  -- construye quien vive en Jamundí, y no una semilla de 1.121
  -- municipios que nadie va a escribir.
  if v_zona is not null then
    perform public.proponer_zona(p_municipio, v_zona);
  end if;

  return v_id;
end;
$$;

revoke execute on function public.guardar_proveedor(
  text,text,text,text,uuid,text,text[],text[],text[],text[],text,jsonb,boolean,text,text)
  from public;
grant execute on function public.guardar_proveedor(
  text,text,text,text,uuid,text,text[],text[],text[],text[],text,jsonb,boolean,text,text)
  to anon, authenticated;

-- ---- Alta asistida ----------------------------------------------------

create or replace function public.crear_proveedor_asistido(
  p_organizacion_id      uuid,
  p_token_hash           text,
  p_nombre_visible       text,
  p_tipo                 text,
  p_telefono             text,
  p_municipio            text,
  p_zona_id              uuid,
  p_zona_texto           text,
  p_modalidad            text[],
  p_oficios              jsonb,
  p_autorizacion_version text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id       uuid;
  v_nombre   text := trim(coalesce(p_nombre_visible, ''));
  v_telefono text := trim(coalesce(p_telefono, ''));
  v_zona     text := nullif(trim(coalesce(p_zona_texto, '')), '');
begin
  if not public.es_miembro_activo(p_organizacion_id, auth.uid()) then
    raise exception 'No autorizado';
  end if;

  if coalesce(char_length(trim(p_token_hash)), 0) <> 64 then
    raise exception 'Token inválido';
  end if;

  if char_length(v_nombre) < 3 or char_length(v_nombre) > 60 then
    raise exception 'El nombre debe tener entre 3 y 60 caracteres';
  end if;
  if public.contiene_pii(v_nombre) then
    raise exception 'El nombre no puede llevar teléfonos ni correos';
  end if;
  if p_tipo not in ('persona','microempresa') then
    raise exception 'Tipo inválido';
  end if;
  if v_telefono !~ '^[0-9+()\- ]{7,20}$' then
    raise exception 'Revisa el teléfono';
  end if;
  if not exists (select 1 from public.municipios m where m.codigo_dane = p_municipio) then
    raise exception 'Municipio inválido';
  end if;

  if p_zona_id is null and v_zona is null then
    raise exception 'Di al menos la comuna o el barrio donde trabaja';
  end if;
  if p_zona_id is not null
     and not exists (select 1 from public.zonas z
                      where z.id = p_zona_id and z.activa and z.estado = 'aprobada'
                        and z.municipio = p_municipio) then
    raise exception 'Esa zona no es de ese municipio';
  end if;
  if v_zona is not null and public.contiene_pii(v_zona) then
    raise exception 'El barrio no puede llevar teléfonos ni correos';
  end if;

  if coalesce(array_length(p_modalidad, 1), 0) = 0
     or not (p_modalidad <@ array['domicilio','local','remoto']) then
    raise exception 'Di dónde atiende esta persona';
  end if;
  if jsonb_array_length(coalesce(p_oficios, '[]'::jsonb)) = 0 then
    raise exception 'Elige al menos un oficio';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_oficios) o
    where not exists (select 1 from public.catalogo_oficios c
                       where c.id = o->>'oficio_id' and c.activo)
       or coalesce(o->>'modo', '') not in ('gratis','aporte','solidario','normal')
  ) then
    raise exception 'Oficio o modo de precio no válido';
  end if;
  if char_length(trim(coalesce(p_autorizacion_version, ''))) < 3 then
    raise exception 'Falta la versión del texto de autorización';
  end if;

  insert into public.proveedores (
    token_hash, organizacion_id, alta_asistida, nombre_visible, tipo,
    telefono, municipio, zona_id, zona_texto, modalidad,
    acepto_publicacion, autorizacion_version, autorizacion_at)
  values (
    trim(p_token_hash), p_organizacion_id, true, v_nombre, p_tipo,
    v_telefono, p_municipio, p_zona_id, v_zona, p_modalidad,
    true, trim(p_autorizacion_version), now())
  returning id into v_id;

  insert into public.proveedor_oficios (proveedor_id, oficio_id, modo)
  select v_id, o->>'oficio_id', o->>'modo'
  from jsonb_array_elements(p_oficios) o;

  if v_zona is not null then
    perform public.proponer_zona(p_municipio, v_zona);
  end if;

  return v_id;
end;
$$;

revoke execute on function public.crear_proveedor_asistido(
  uuid,text,text,text,text,text,uuid,text,text[],jsonb,text) from public, anon;
grant execute on function public.crear_proveedor_asistido(
  uuid,text,text,text,text,text,uuid,text,text[],jsonb,text) to authenticated;

-- ---- La solicitud de servicio -----------------------------------------

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
  v_codigo  text;
  v_zona    text := nullif(trim(coalesce(p_zona_texto, '')), '');
  v_nota    text := nullif(trim(coalesce(p_nota, '')), '');
  v_id      uuid;
  v_intento integer := 0;
begin
  if not exists (select 1 from public.catalogo_oficios c
                  where c.id = p_oficio_id and c.activo) then
    raise exception 'Oficio no válido';
  end if;

  if not exists (select 1 from public.municipios m where m.codigo_dane = p_municipio) then
    raise exception 'Municipio inválido';
  end if;

  if p_zona_id is null and v_zona is null then
    raise exception 'Di al menos la comuna o el barrio donde necesitas el servicio';
  end if;

  if p_zona_id is not null
     and not exists (select 1 from public.zonas z
                      where z.id = p_zona_id and z.activa and z.estado = 'aprobada'
                        and z.municipio = p_municipio) then
    raise exception 'Esa zona no es de ese municipio';
  end if;

  if v_zona is not null then
    if char_length(v_zona) < 2 or char_length(v_zona) > 60 then
      raise exception 'El barrio debe tener entre 2 y 60 caracteres';
    end if;
    if public.contiene_pii(v_zona) then
      raise exception 'El barrio no puede llevar teléfonos ni correos';
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
    if public.contiene_pii(v_nota) then
      raise exception 'La nota no puede llevar teléfonos ni correos. Quien te responda te va a dejar el suyo.';
    end if;
  end if;

  if coalesce(char_length(trim(p_token)), 0) < 20 then
    raise exception 'Token inválido';
  end if;

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

  if v_zona is not null then
    perform public.proponer_zona(p_municipio, v_zona);
  end if;

  return query select v_id, v_codigo;
end;
$$;

revoke execute on function public.crear_solicitud_servicio(
  text,text,uuid,text,text,text,text,text) from public, anon, authenticated;

comment on function public.crear_solicitud_servicio(
  text,text,uuid,text,text,text,text,text) is
  'La llama el servidor de Next con la llave de servicio, como crear_solicitud: el token lo genera allá. Sin grant a anon, para que el token no pueda entrar desde el navegador sin pasar por el Turnstile.';

-- ---------------------------------------------------------------------
-- 6. El panel del administrador cuenta las zonas por revisar
-- ---------------------------------------------------------------------

create or replace function public.panel_admin_servicios()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  return jsonb_build_object(
    'por_verificar', coalesce((
      select jsonb_agg(x order by (x->>'oficios_esperando')::int desc,
                                  x->>'creado_at')
      from (
        select jsonb_build_object(
          'id', p.id,
          'nombre_visible', p.nombre_visible,
          'telefono', p.telefono,
          'municipio', p.municipio,
          'creado_at', p.creado_at,
          'organizacion', o.nombre,
          'oficios_esperando', (
            select count(*)
            from public.proveedor_oficios po
            join public.catalogo_oficios c on c.id = po.oficio_id
            where po.proveedor_id = p.id and c.riesgo = 'alto')
        ) as x
        from public.proveedores p
        left join public.organizaciones o on o.id = p.organizacion_id
        where not p.telefono_verificado and not p.suspendido
      ) s), '[]'::jsonb),

    'suspendidos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'nombre_visible', p.nombre_visible,
        'municipio', p.municipio,
        'actualizado_at', p.actualizado_at
      ) order by p.actualizado_at desc)
      from public.proveedores p where p.suspendido), '[]'::jsonb),

    'resenas_ocultas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'proveedor_id', r.proveedor_id,
        'proveedor_nombre', p.nombre_visible,
        'comentario', r.comentario,
        'replica', r.replica,
        'creada_at', r.creada_at
      ) order by r.creada_at desc)
      from public.resenas r
      join public.proveedores p on p.id = r.proveedor_id
      where r.oculta), '[]'::jsonb),

    'referencias_pendientes', (
      select count(*) from public.referencias r where r.estado = 'pendiente'),

    'zonas_pendientes', (
      select count(*) from public.zonas z where z.estado = 'propuesta'),

    'totales', jsonb_build_object(
      'proveedores', (select count(*) from public.proveedores),
      'publicados', (select count(*) from public.proveedores_publicos),
      'solicitudes', (select count(*) from public.solicitudes_servicio),
      'servicios_confirmados', (
        select count(*) from public.servicios_prestados
         where confirmado_at is not null))
  );
end;
$$;

revoke execute on function public.panel_admin_servicios() from public, anon;
grant  execute on function public.panel_admin_servicios() to authenticated;
