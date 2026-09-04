-- =====================================================================
-- v6 · Fase F · 3 — Municipio, barrio y dirección, cada uno con lo suyo
--
-- ADR 0017. El barrio pasa a ser el dato principal y obligatorio de la
-- ubicación de un prestador; la comuna pasa a ser secundaria y opcional
-- -"muchas personas no saben a cuál pertenecen"-; y se agrega una
-- dirección, opcional, con su propia autorización aparte, siguiendo el
-- mismo patrón que el ADR 0004 ya usó para el punto en el mapa.
--
-- Va en el mismo archivo, aunque el nombre solo hable de eso, el retiro de
-- la matrícula profesional del registro (sección 3 de la tarea): es la
-- única migración de este encargo y ambos cambios tocan `crear_perfil` /
-- `guardar_proveedor`, la misma familia de funciones.
--
-- NO SE APLICA CONTRA NINGUNA BASE DESDE AQUÍ. Solo se escribe.
--
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Dirección: columnas nuevas en `proveedores`
-- ---------------------------------------------------------------------
--
-- Mismo patrón que `latitud`/`longitud`/`acepto_mapa` de `v4-b1`: la
-- dirección se guarda siempre que se escriba, autorizada o no -es la vista
-- pública la que decide qué enseña, no cada consulta-, y `acepto_direccion`
-- es una casilla APARTE de `acepto_publicacion` y de `acepto_mapa`: publicar
-- dónde vive o atiende alguien es una finalidad distinta de publicar su
-- nombre o su punto en el mapa (artículo 9 de la Ley 1581).

alter table public.proveedores
  add column if not exists direccion text,
  add column if not exists acepto_direccion boolean not null default false,
  add column if not exists direccion_version text,
  add column if not exists direccion_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'proveedores_direccion_tope'
  ) then
    alter table public.proveedores
      add constraint proveedores_direccion_tope
      check (direccion is null or char_length(direccion) <= 120);
  end if;
end $$;

-- Autorizar sin haber escrito nada autorizaría publicar la nada. Mismo
-- invariante que `proveedores_mapa_completo`.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'proveedores_direccion_completa'
  ) then
    alter table public.proveedores
      add constraint proveedores_direccion_completa
      check (
        not acepto_direccion
        or (direccion is not null and direccion_version is not null)
      );
  end if;
end $$;

comment on column public.proveedores.acepto_direccion is
  'Autorización SEPARADA de acepto_publicacion y de acepto_mapa, artículo 9 de la Ley 1581 (ADR 0017): publicar dónde vive o atiende alguien es otra finalidad. Sin marcar, la dirección se guarda pero proveedores_publicos la devuelve NULL.';

-- ---------------------------------------------------------------------
-- 2 · `guardar_proveedor`: barrio obligatorio, comuna opcional, dirección
-- ---------------------------------------------------------------------
--
-- La función entera otra vez -plpgsql no admite parches-, con tres
-- cambios sobre la de `v3-s9-bre-b.sql`:
--
--   a) donde decía "al menos una de las dos" (zona_id o zona_texto), ahora
--      el barrio (zona_texto) es el único obligatorio; la comuna (zona_id)
--      queda del todo aparte y nunca bloquea.
--   b) tres parámetros nuevos, opcionales, para la dirección.
--   c) la dirección se valida como cualquier campo libre: tope, filtro de
--      PII -por si alguien intenta colar un teléfono ahí-, y completitud
--      si se autoriza publicarla.

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
  p_token                text default null
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

  -- ADR 0017: el barrio es el único obligatorio. La comuna es secundaria
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

  if v_desc is not null then
    if char_length(v_desc) > 300 then
      raise exception 'La descripción no puede pasar de 300 caracteres';
    end if;
    if public.contiene_pii(v_desc) then
      raise exception 'La descripción no puede llevar teléfonos ni correos: tu número ya sale en tu ficha';
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

  if v_id is null then
    insert into public.proveedores (
      perfil_id, nombre_visible, tipo, telefono, municipio, zona_id,
      zona_texto, modalidad, dias, franjas, medios_pago, descripcion,
      acepto_publicacion, autorizacion_version, autorizacion_at,
      direccion, acepto_direccion, direccion_version, direccion_at)
    values (
      v_uid, v_nombre, p_tipo, v_telefono, p_municipio, p_zona_id,
      v_zona, p_modalidad, coalesce(p_dias, '{}'), coalesce(p_franjas, '{}'),
      coalesce(p_medios_pago, '{}'), v_desc,
      true, trim(p_autorizacion_version), now(),
      v_direccion, v_acepto_dir,
      case when v_acepto_dir then trim(p_direccion_version) end,
      case when v_acepto_dir then now() end)
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
  text,text,text,text,uuid,text,text[],text[],text[],text[],text,jsonb,boolean,text,text,boolean,text,text)
  from public;
grant execute on function public.guardar_proveedor(
  text,text,text,text,uuid,text,text[],text[],text[],text[],text,jsonb,boolean,text,text,boolean,text,text)
  to anon, authenticated;

-- La firma vieja, de quince parámetros y sin dirección, se retira: dejarla
-- viva dejaría una puerta que guarda una ficha sin poder decir nada de la
-- dirección y sin el barrio obligatorio.
drop function if exists public.guardar_proveedor(
  text,text,text,text,uuid,text,text[],text[],text[],text[],text,jsonb,boolean,text,text);

-- ---------------------------------------------------------------------
-- 3 · `mi_proveedor()`: devuelve la dirección y su autorización
-- ---------------------------------------------------------------------
--
-- Mismo objeto, mismos campos que ya trae para el mapa. La firma no
-- cambia -sigue siendo `p_token text default null`- así que esto SÍ
-- reemplaza a la anterior en vez de sumarse a ella.

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
    -- Lo que se añade en v6-f3 (ADR 0017): la dirección y su autorización
    -- aparte, igual que el mapa y la foto.
    'direccion', p.direccion,
    'acepto_direccion', p.acepto_direccion,
    'direccion_version', p.direccion_version,
    'direccion_at', p.direccion_at,
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

-- ---------------------------------------------------------------------
-- 4 · La vista pública: la dirección sale SOLO si `acepto_direccion`
-- ---------------------------------------------------------------------
--
-- Mismo patrón que las coordenadas de `v4-b1`: el filtro vive AQUÍ, no en
-- cada consulta -si se duplicara, un día una copia se olvida, y aquí
-- olvidarse significa publicar dónde vive alguien que no lo autorizó.

drop view if exists public.proveedores_publicos cascade;

create view public.proveedores_publicos as
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
  coalesce(ofi.modos, '{}'::text[]) as modos
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

-- Lo que el `cascade` de arriba se llevó por delante (mismo motivo que en
-- `v4-b1`: recrear lo que colgaba de la vista).

create or replace view public.municipios_con_proveedores as
select distinct m.codigo_dane, m.nombre, m.departamento
from public.municipios m
join public.proveedores_publicos p on p.municipio = m.codigo_dane;

grant select on public.municipios_con_proveedores to anon, authenticated;

create or replace view public.oficios_con_proveedores as
select distinct o.id, o.nombre, o.grupo, o.orden
from public.catalogo_oficios o
join public.proveedor_oficios_publicos pop on pop.oficio_id = o.id;

grant select on public.oficios_con_proveedores to anon, authenticated;

-- =====================================================================
-- 5 · La matrícula profesional sale del registro (sección 3 de la tarea)
-- =====================================================================
--
-- El cliente: «Quitar la matrícula profesional pero dejar igual las
-- preguntas: profesión, descripción del servicio». `crear_perfil` seguía
-- exigiendo entidad y número de matrícula para declararse `servidor`;
-- ahora solo exige la profesión, y entidad/número se pueden dejar en
-- blanco y llenar después desde `/perfil/verificaciones`.
--
-- No se borra ninguna columna: `servidores.entidad_matricula` y
-- `numero_matricula` pasan de NOT NULL a nulables, nada más. El `unique`
-- sobre las dos sigue en pie -Postgres no considera duplicado a
-- (NULL, NULL) contra otro (NULL, NULL), así que muchos servidores sin
-- matrícula todavía conviven sin problema.

alter table public.servidores
  alter column entidad_matricula drop not null,
  alter column numero_matricula drop not null;

comment on column public.servidores.entidad_matricula is
  'Opcional desde v6-f3: la matrícula se retiró del registro y ahora se llena, si se quiere, desde /perfil/verificaciones. NULL significa "todavía no la dio", no "no tiene".';
comment on column public.servidores.numero_matricula is
  'Opcional desde v6-f3, mismo motivo que entidad_matricula.';

create or replace function public.crear_perfil(
  p_nombre_visible text,
  p_tipo text,
  p_municipios text[],
  p_contacto_publico text,
  p_contacto_tipo text,
  p_descripcion text,
  p_profesion text default null,
  p_entidad_matricula text default null,
  p_numero_matricula text default null,
  p_servicios text[] default '{}'::text[],
  p_puede_trasladarse boolean default false,
  p_autorizacion_version text default null
)
returns void
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_publica boolean := p_tipo <> 'aliado';
  v_version text := nullif(btrim(coalesce(p_autorizacion_version, '')), '');
  v_numero text := nullif(btrim(coalesce(p_numero_matricula, '')), '');
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

  if v_publica and v_version is null then
    raise exception 'Falta la versión del texto de autorización';
  end if;

  insert into public.perfiles (
    id, nombre_visible, tipo, municipios, contacto_publico,
    contacto_tipo, descripcion, acepto_publicacion, acepto_politica_at,
    autorizacion_version, puede_trasladarse)
  values (
    v_uid, p_nombre_visible, p_tipo, p_municipios,
    case when p_tipo = 'aliado' then null else p_contacto_publico end,
    case when p_tipo = 'aliado' then 'whatsapp' else p_contacto_tipo end,
    nullif(trim(p_descripcion), ''),
    v_publica, now(),
    case when v_publica then v_version end,
    coalesce(p_puede_trasladarse, false))
  on conflict (id) do update set
    nombre_visible       = excluded.nombre_visible,
    tipo                 = excluded.tipo,
    municipios           = excluded.municipios,
    contacto_publico     = excluded.contacto_publico,
    contacto_tipo        = excluded.contacto_tipo,
    descripcion          = excluded.descripcion,
    acepto_publicacion   = excluded.acepto_publicacion,
    acepto_politica_at   = now(),
    autorizacion_version = excluded.autorizacion_version,
    puede_trasladarse    = excluded.puede_trasladarse;

  if p_tipo = 'servidor' then
    -- v6-f3: ya no se exige entidad ni número aquí. Eso es cosa de
    -- /perfil/verificaciones, después, y opcional (regla de producto 6:
    -- nada nace verificado, y aquí ni siquiera nace declarado).
    if coalesce(trim(p_profesion), '') = '' then
      raise exception 'Indica tu profesión';
    end if;

    if v_numero is not null then
      if p_entidad_matricula is null then
        raise exception 'Indica también la entidad de tu matrícula';
      end if;
      if exists (select 1 from public.servidores sv
                  where sv.entidad_matricula = p_entidad_matricula
                    and sv.numero_matricula = v_numero
                    and sv.perfil_id <> v_uid) then
        raise exception 'Esa matrícula ya está registrada por otra persona';
      end if;
    end if;

    if exists (select 1 from unnest(p_servicios) s
                where s not in (select c.id from public.catalogo_servicios c where c.activo)) then
      raise exception 'Servicio no válido';
    end if;

    insert into public.servidores (perfil_id, profesion, entidad_matricula, numero_matricula, servicios)
    values (v_uid, trim(p_profesion), p_entidad_matricula, v_numero, p_servicios)
    on conflict (perfil_id) do update set
      profesion = excluded.profesion,
      servicios = excluded.servicios;
      -- ⚠ entidad_matricula y numero_matricula NO se pisan aquí: el
      -- registro ya no los pide, y sobrescribirlos con lo que llega en
      -- blanco borraría una matrícula que la persona haya puesto después
      -- desde /perfil/verificaciones.
  else
    delete from public.servidores where perfil_id = v_uid;
  end if;
end;
$function$;

revoke execute on function public.crear_perfil(text,text,text[],text,text,text,text,text,text,text[],boolean,text) from public, anon;
grant  execute on function public.crear_perfil(text,text,text[],text,text,text,text,text,text,text[],boolean,text) to authenticated;

-- ---------------------------------------------------------------------
-- 6 · `guardar_matricula`: el paso opcional y posterior
-- ---------------------------------------------------------------------
--
-- Vive en /perfil/verificaciones. Cambiar la matrícula invalida cualquier
-- verificación anterior -hay que comprobar el número nuevo contra el
-- registro de la entidad, no el viejo-, así que resetea `verificado`.

create or replace function public.guardar_matricula(
  p_entidad_matricula text,
  p_numero_matricula text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_numero text := nullif(trim(coalesce(p_numero_matricula, '')), '');
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if not exists (select 1 from public.servidores where perfil_id = v_uid) then
    raise exception 'Primero marca en tu perfil que ofreces servicios profesionales';
  end if;

  if p_entidad_matricula is null
     or p_entidad_matricula not in ('COPNIA','CPNAA','COLPSIC','ReTHUS','SIRNA','OTRA') then
    raise exception 'Entidad inválida';
  end if;
  if v_numero is null then
    raise exception 'Falta el número de matrícula';
  end if;
  if char_length(v_numero) > 40 then
    raise exception 'El número de matrícula no puede pasar de 40 caracteres';
  end if;

  if exists (select 1 from public.servidores sv
              where sv.entidad_matricula = p_entidad_matricula
                and sv.numero_matricula = v_numero
                and sv.perfil_id <> v_uid) then
    raise exception 'Esa matrícula ya está registrada por otra persona';
  end if;

  update public.servidores set
    entidad_matricula = p_entidad_matricula,
    numero_matricula  = v_numero,
    verificado        = false,
    verificado_at     = null,
    verificado_por    = null
  where perfil_id = v_uid;
end;
$$;

revoke execute on function public.guardar_matricula(text, text) from public, anon;
grant  execute on function public.guardar_matricula(text, text) to authenticated;

-- ---------------------------------------------------------------------
-- 7 · `servidores_publicos` y `municipios_con_servidores`: solo con
--     matrícula puesta
-- ---------------------------------------------------------------------
--
-- `/profesionales` se presenta a sí misma como "el directorio de
-- profesionales con matrícula" (`src/app/profesionales/page.tsx`). Desde
-- que la matrícula es opcional y posterior, puede existir un `servidor`
-- con profesión y servicios pero sin entidad ni número -alguien que
-- todavía no llegó a /perfil/verificaciones-, y esa fila no pertenece
-- todavía a esta lista: mostrarla sería "Matrícula null" en pantalla.
--
-- Mismo patrón de siempre: el filtro vive en la vista, no en cada
-- consulta.

create or replace view public.servidores_publicos as
select p.id, p.nombre_visible, p.municipios, p.contacto_publico, p.contacto_tipo,
       p.descripcion, sv.profesion, sv.entidad_matricula, sv.numero_matricula,
       sv.verificado, sv.servicios
from public.perfiles p
join public.servidores sv on sv.perfil_id = p.id
where p.tipo = 'servidor'
  and p.suspendido = false
  and p.acepto_publicacion = true
  and sv.numero_matricula is not null;

comment on view public.servidores_publicos is
  'El directorio de /profesionales: solo servidores que YA declararon una matrícula (entidad y número), verificada o no. Quien todavía no la puso no sale aquí -sigue existiendo como servidor, solo que sin matrícula que enseñar.';

grant select on public.servidores_publicos to anon, authenticated;

create or replace view public.municipios_con_servidores as
select distinct m.codigo_dane, m.nombre, m.departamento
from public.municipios m
join public.perfiles p on m.codigo_dane = any (p.municipios)
join public.servidores sv on sv.perfil_id = p.id
where p.tipo = 'servidor'
  and p.suspendido = false
  and p.acepto_publicacion = true
  and sv.numero_matricula is not null;

grant select on public.municipios_con_servidores to anon, authenticated;

-- Comprobar:
--   select acepto_direccion, direccion from public.proveedores_publicos limit 5;
--   select public.mi_proveedor() -> 'direccion';
--   select count(*) from public.servidores where numero_matricula is null;   -- ya no debería dar error
