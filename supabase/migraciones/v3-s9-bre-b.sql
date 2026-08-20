-- =====================================================================
-- v3 · Fase S9 — Bre-B como medio de pago
--
-- Bre-B es el sistema de pagos inmediatos del Banco de la República.
-- Entra al lado de Nequi y Daviplata, y como esa lista ya cambió una vez
-- va a volver a cambiar, la sacamos del cuerpo de la función: de aquí en
-- adelante agregar un medio de pago es tocar `medios_pago_validos()` y
-- nada más, en vez de volver a volcar doscientas líneas de
-- `guardar_proveedor` con una palabra distinta.
--
-- `medios_pago` no tiene CHECK en la tabla, a propósito: la validación
-- vive en la RPC porque de ahí sale el mensaje que lee la persona. Un
-- CHECK violado no se le puede enseñar a nadie.
--
-- Idempotente.
-- =====================================================================

create or replace function public.medios_pago_validos()
returns text[]
language sql
immutable
as $$
  select array['efectivo','nequi','daviplata','bre_b'];
$$;

revoke execute on function public.medios_pago_validos()
  from public, anon, authenticated;

comment on function public.medios_pago_validos() is
  'Gemela de MEDIOS_PAGO en src/lib/servicios.ts. Si se agrega uno aquí, se agrega allá: aquí se rechaza y allá se dibuja.';

-- La función entera otra vez, porque plpgsql no admite parches. Es
-- idéntica a la de `v3-s8-zonas.sql` salvo la línea que valida los
-- medios de pago.
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
  if not (coalesce(p_medios_pago, '{}') <@ public.medios_pago_validos()) then
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
