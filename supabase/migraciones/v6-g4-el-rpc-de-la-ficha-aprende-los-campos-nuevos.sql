-- =====================================================================
-- v6 · Fase G · 4 — `guardar_proveedor` y `mi_proveedor` aprenden
-- precio_hasta, nombre_negocio y horario exacto
--
-- ADR 0026 y ADR 0027. La escritura de la ficha todavía no pasó al
-- contrato oRPC (CLAUDE.md § "Estado de la migración", paso 2): sigue
-- siendo la RPC `guardar_proveedor`, así que las columnas nuevas de
-- v6-g1 y v6-g2 son invisibles para el formulario hasta que esta función
-- las reciba y las valide — no basta con que existan en la tabla.
--
-- Se toca también la validación de largo de `descripcion`: seguía en
-- 300 aquí, duplicada respecto al CHECK de v6-g3 que ya bajó a 200. Las
-- dos tienen que decir lo mismo, o el mensaje de error miente sobre el
-- tope real.
--
-- `p_oficios` es el mismo arreglo jsonb de siempre, con una clave más
-- (`precio_hasta`) por elemento — no hace falta un parámetro nuevo para
-- eso. `p_nombre_negocio`, `p_hora_desde`, `p_hora_hasta` sí son
-- parámetros nuevos, al final y con `default null`: así ninguna llamada
-- vieja se rompe mientras el formulario no los mande.
--
-- Las dos vistas públicas se amplían con `create or replace view`, no con
-- `drop ... cascade`: las columnas nuevas van al final de la lista, que
-- es justo lo que Postgres permite sin tener que recrear todo lo que
-- cuelga de ellas (`municipios_con_proveedores`, `productos_publicos`,
-- etc. no se tocan).
--
-- Idempotente en las vistas y la función (create or replace). La función
-- vieja de 18 parámetros se retira al final, como ya es la costumbre en
-- este archivo de migraciones.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Las dos vistas públicas, con las columnas nuevas al final
-- ---------------------------------------------------------------------

create or replace view public.proveedor_oficios_publicos as
select po.proveedor_id, po.oficio_id, po.modo, po.precio_desde, po.unidad,
       o.nombre as oficio_nombre, o.grupo, o.riesgo,
       po.precio_hasta
from public.proveedor_oficios po
join public.catalogo_oficios o on o.id = po.oficio_id
join public.proveedores p      on p.id = po.proveedor_id
where o.activo
  and not p.suspendido
  and p.acepto_publicacion
  and (
    o.riesgo = 'bajo'
    or (p.telefono_verificado
        and exists (select 1 from public.referencias r
                     where r.proveedor_id = p.id and r.estado = 'confirmada'))
  );

comment on view public.proveedor_oficios_publicos is
  'Regla S de PLAN-V3: un oficio de riesgo alto no se publica si el proveedor no tiene teléfono verificado Y una referencia confirmada. Es la única capa donde se aplica ese filtro, a propósito: si se duplica, un día una de las dos copias se olvida.';

grant select on public.proveedor_oficios_publicos to anon, authenticated;

create or replace view public.proveedores_publicos as
select
  p.id, p.nombre_visible, p.tipo, p.telefono, p.telefono_verificado,
  p.municipio, p.zona_id, z.nombre as zona_nombre, p.zona_texto,
  p.modalidad, p.dias, p.franjas, p.medios_pago, p.descripcion, p.creado_at,
  case when p.acepto_mapa then p.latitud  end as latitud,
  case when p.acepto_mapa then p.longitud end as longitud,
  case when p.acepto_direccion then p.direccion end as direccion,
  coalesce(ofi.oficios, '{}'::text[]) as oficios,
  coalesce(ofi.grupos,  '{}'::text[]) as grupos,
  coalesce(ref.confirmadas, 0::bigint) as referencias_confirmadas,
  coalesce(sp.confirmados,  0::bigint) as servicios_confirmados,
  res.cumplimiento, res.trato, res.puntualidad,
  coalesce(res.total, 0::bigint) as total_resenas,
  coalesce(ofi.modos, '{}'::text[]) as modos,
  (select i.ruta from public.imagenes i
    where i.objeto_tipo = 'proveedor' and i.objeto_id = p.id and i.estado = 'aprobada'
    order by i.subida_at limit 1) as foto,
  p.nombre_negocio, p.hora_desde, p.hora_hasta
from public.proveedores p
left join public.zonas z on z.id = p.zona_id
join lateral (
  select array_agg(distinct pop.oficio_id) as oficios,
         array_agg(distinct pop.grupo)     as grupos,
         array_agg(distinct pop.modo)      as modos
  from public.proveedor_oficios_publicos pop
  where pop.proveedor_id = p.id
) ofi on ofi.oficios is not null
left join lateral (
  select count(*) as confirmadas from public.referencias r
  where r.proveedor_id = p.id and r.estado = 'confirmada'
) ref on true
left join lateral (
  select count(*) as confirmados from public.servicios_prestados s
  where s.proveedor_id = p.id and s.confirmado_at is not null
) sp on true
left join lateral (
  select count(*) as total,
         round(avg(r.cumplimiento), 1) as cumplimiento,
         round(avg(r.trato), 1)        as trato,
         round(avg(r.puntualidad), 1)  as puntualidad
  from public.resenas r
  where r.proveedor_id = p.id and not r.oculta
) res on true
where not p.suspendido and p.acepto_publicacion and p.telefono_verificado;

comment on view public.proveedores_publicos is
  'La única puerta al directorio. Aplica la regla de producto 7 (oficios de riesgo alto escondidos sin respaldo) y los consentimientos de mapa y dirección: latitud, longitud y dirección salen NULL sin su casilla propia marcada.';

grant select on public.proveedores_publicos to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2 · `guardar_proveedor`: tres parámetros nuevos, tope de descripción
-- corregido a 200, y `precio_hasta` dentro de cada elemento de p_oficios
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
  p_direccion            text default null,
  p_acepto_direccion     boolean default false,
  p_direccion_version    text default null,
  p_token                text default null,
  p_nombre_negocio       text default null,
  p_hora_desde           time default null,
  p_hora_hasta           time default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id         uuid := public.proveedor_del_llamante(p_token);
  v_uid        uuid := auth.uid();
  v_nombre     text := trim(coalesce(p_nombre_visible, ''));
  v_telefono   text := trim(coalesce(p_telefono, ''));
  v_zona       text := nullif(trim(coalesce(p_zona_texto, '')), '');
  v_desc       text := nullif(trim(coalesce(p_descripcion, '')), '');
  v_direccion  text := nullif(trim(coalesce(p_direccion, '')), '');
  v_acepto_dir boolean := coalesce(p_acepto_direccion, false);
  v_negocio    text := nullif(trim(coalesce(p_nombre_negocio, '')), '');
  v_n          integer;
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

  -- ADR 0019: el barrio es el único obligatorio. La comuna es secundaria
  -- y puede faltar -"muchas personas no saben a cuál pertenecen"-.
  if v_zona is null then
    raise exception 'Di tu barrio';
  end if;

  if p_zona_id is not null
     and not exists (select 1 from public.zonas z
                      where z.id = p_zona_id and z.activa and z.estado = 'aprobada'
                        and z.municipio = p_municipio) then
    raise exception 'Esa zona no es de ese municipio';
  end if;

  if public.contiene_pii(v_zona) then
    raise exception 'El barrio no puede llevar teléfonos ni correos';
  end if;
  if char_length(v_zona) < 2 or char_length(v_zona) > 60 then
    raise exception 'El barrio debe tener entre 2 y 60 caracteres';
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

  -- ADR 0027: hora exacta, opcional, SUMADA a la franja amplia de arriba
  -- -no la reemplaza-. Si se declaran las dos, hasta tiene que ser mayor.
  if p_hora_hasta is not null and p_hora_desde is not null and p_hora_hasta <= p_hora_desde then
    raise exception 'La hora hasta debe ser mayor que la hora desde';
  end if;

  if v_desc is not null then
    if char_length(v_desc) > 200 then
      raise exception 'La descripción no puede pasar de 200 caracteres';
    end if;
    if public.contiene_pii(v_desc) then
      raise exception 'La descripción no puede llevar teléfonos ni correos: tu número ya sale en tu ficha';
    end if;
  end if;

  -- ADR 0027: el nombre del negocio es un campo libre más, mismo tope de
  -- 60 que ya tiene nombre_visible y el mismo filtro de PII.
  if v_negocio is not null then
    if char_length(v_negocio) < 3 or char_length(v_negocio) > 60 then
      raise exception 'El nombre del negocio debe tener entre 3 y 60 caracteres';
    end if;
    if public.contiene_pii(v_negocio) then
      raise exception 'El nombre del negocio no puede llevar teléfonos ni correos';
    end if;
  end if;

  -- La dirección: campo libre como cualquier otro (regla de producto 4),
  -- con su tope, su filtro y -si se autoriza publicarla- su completitud.
  if v_direccion is not null then
    if char_length(v_direccion) > 120 then
      raise exception 'La dirección no puede pasar de 120 caracteres';
    end if;
    if public.contiene_pii(v_direccion) then
      raise exception 'La dirección no puede llevar teléfonos ni correos: tu número ya sale en tu ficha';
    end if;
  end if;
  if v_acepto_dir and v_direccion is null then
    raise exception 'Escribe tu dirección antes de autorizar publicarla';
  end if;
  if v_acepto_dir and char_length(trim(coalesce(p_direccion_version, ''))) < 3 then
    raise exception 'Falta la versión del texto de autorización de la dirección';
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

  -- ADR 0026: el techo, si viene, tiene que ser mayor o igual al piso.
  if exists (
    select 1 from jsonb_array_elements(p_oficios) o
    where nullif(o->>'precio_hasta', '') is not null
      and nullif(o->>'precio_desde', '') is not null
      and (o->>'precio_hasta')::numeric < (o->>'precio_desde')::numeric
  ) then
    raise exception 'El precio hasta no puede ser menor que el precio desde';
  end if;

  if v_id is null then
    insert into public.proveedores (
      perfil_id, nombre_visible, tipo, telefono, municipio, zona_id,
      zona_texto, modalidad, dias, franjas, medios_pago, descripcion,
      acepto_publicacion, autorizacion_version, autorizacion_at,
      direccion, acepto_direccion, direccion_version, direccion_at,
      nombre_negocio, hora_desde, hora_hasta)
    values (
      v_uid, v_nombre, p_tipo, v_telefono, p_municipio, p_zona_id,
      v_zona, p_modalidad, coalesce(p_dias, '{}'), coalesce(p_franjas, '{}'),
      coalesce(p_medios_pago, '{}'), v_desc,
      true, trim(p_autorizacion_version), now(),
      v_direccion, v_acepto_dir,
      case when v_acepto_dir then trim(p_direccion_version) end,
      case when v_acepto_dir then now() end,
      v_negocio, p_hora_desde, p_hora_hasta)
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
      direccion         = v_direccion,
      acepto_direccion  = v_acepto_dir,
      direccion_version = case when v_acepto_dir then trim(p_direccion_version) end,
      direccion_at      = case when v_acepto_dir then now() end,
      nombre_negocio    = v_negocio,
      hora_desde        = p_hora_desde,
      hora_hasta        = p_hora_hasta,
      actualizado_at       = now()
    where id = v_id;
  end if;

  delete from public.proveedor_oficios where proveedor_id = v_id;

  insert into public.proveedor_oficios (proveedor_id, oficio_id, modo, precio_desde, precio_hasta, unidad)
  select v_id,
         o->>'oficio_id',
         o->>'modo',
         case when o->>'modo' in ('solidario','normal')
              then nullif(o->>'precio_desde', '')::numeric end,
         case when o->>'modo' in ('solidario','normal')
              then nullif(o->>'precio_hasta', '')::numeric end,
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
  text,text,text,text,uuid,text,text[],text[],text[],text[],text,jsonb,boolean,text,text,boolean,text,text,text,time,time)
  from public;
grant execute on function public.guardar_proveedor(
  text,text,text,text,uuid,text,text[],text[],text[],text[],text,jsonb,boolean,text,text,boolean,text,text,text,time,time)
  to anon, authenticated;

-- La firma de v6-f5 (dieciocho parámetros, sin negocio ni horario) se
-- retira: dejarla viva dejaría una puerta que guarda una ficha aplicando
-- todavía el tope de 300 caracteres en vez de 200.
drop function if exists public.guardar_proveedor(
  text,text,text,text,uuid,text,text[],text[],text[],text[],text,jsonb,boolean,text,text,boolean,text,text);

-- ---------------------------------------------------------------------
-- 3 · `mi_proveedor()`: devuelve los tres campos nuevos y el precio_hasta
-- de cada oficio. Misma firma -sigue siendo `p_token text default
-- null`-, así que esto SÍ reemplaza a la anterior en vez de sumarse.
-- ---------------------------------------------------------------------

create or replace function public.mi_proveedor(p_token text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_id uuid := public.proveedor_del_llamante(p_token);
  v_out jsonb;
begin
  if v_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'id', p.id,
    'nombre_visible', p.nombre_visible,
    'tipo', p.tipo,
    'telefono', p.telefono,
    'telefono_verificado', p.telefono_verificado,
    'municipio', p.municipio,
    'zona_id', p.zona_id,
    'zona_texto', p.zona_texto,
    'modalidad', p.modalidad,
    'dias', p.dias,
    'franjas', p.franjas,
    'medios_pago', p.medios_pago,
    'descripcion', p.descripcion,
    'suspendido', p.suspendido,
    'alta_asistida', p.alta_asistida,
    'sin_cuenta', p.perfil_id is null,
    'creado_at', p.creado_at,
    'autorizacion_version', p.autorizacion_version,
    'autorizacion_at', p.autorizacion_at,
    'acepto_mapa', p.acepto_mapa,
    'mapa_version', p.mapa_version,
    'mapa_at', p.mapa_at,
    'acepto_foto', p.acepto_foto,
    'foto_version', p.foto_version,
    'foto_at', p.foto_at,
    'direccion', p.direccion,
    'acepto_direccion', p.acepto_direccion,
    'direccion_version', p.direccion_version,
    'direccion_at', p.direccion_at,
    -- Lo que se añade en v6-g2 / v6-g4 (ADR 0027): nombre de negocio y
    -- horario por hora exacta, además de dias/franjas que ya traía.
    'nombre_negocio', p.nombre_negocio,
    'hora_desde', p.hora_desde,
    'hora_hasta', p.hora_hasta,
    'foto', (
      select i.ruta
        from public.imagenes i
       where i.objeto_tipo = 'proveedor'
         and i.objeto_id = p.id
       order by i.subida_at
       limit 1),
    'foto_estado', (
      select i.estado
        from public.imagenes i
       where i.objeto_tipo = 'proveedor'
         and i.objeto_id = p.id
       order by i.subida_at
       limit 1),
    'oficios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'oficio_id', po.oficio_id,
               'nombre', c.nombre,
               'grupo', c.grupo,
               'riesgo', c.riesgo,
               'modo', po.modo,
               'precio_desde', po.precio_desde,
               -- Techo opcional del rango -- v6-g1 / ADR 0026.
               'precio_hasta', po.precio_hasta,
               'unidad', po.unidad,
               'publicado', (c.riesgo <> 'alto')
                 or (p.telefono_verificado and exists (
                       select 1 from public.referencias r
                        where r.proveedor_id = p.id and r.estado = 'confirmada'))
               ) order by c.orden)
      from public.proveedor_oficios po
      join public.catalogo_oficios c on c.id = po.oficio_id
      where po.proveedor_id = p.id), '[]'::jsonb),
    'referencias_confirmadas', (
      select count(*) from public.referencias r
       where r.proveedor_id = p.id and r.estado = 'confirmada'),
    'servicios_confirmados', (
      select count(*) from public.servicios_prestados s
       where s.proveedor_id = p.id and s.confirmado_at is not null)
  )
  into v_out
  from public.proveedores p
  where p.id = v_id;

  return v_out;
end;
$function$;

-- Comprobar:
--   select proveedor_id, precio_desde, precio_hasta from public.proveedor_oficios_publicos limit 5;
--   select nombre_negocio, hora_desde, hora_hasta from public.proveedores_publicos limit 5;
