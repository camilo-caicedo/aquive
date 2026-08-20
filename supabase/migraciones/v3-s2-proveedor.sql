-- =====================================================================
-- v3 · Fase S2 — Alta y edición del proveedor
--
-- 🔴 Esta es la migración que empieza a RECOLECTAR. Hasta S1 solo había
-- tablas vacías; a partir de aquí una pantalla guarda el nombre y el
-- teléfono de una persona y los publica en internet, sin fecha de
-- caducidad. Los papeles de PLAN-V3 §7 van antes que el despliegue de
-- esto, no después: contrato de encargo firmado, RNBD a nombre de la
-- fundación, y el NIT y el correo de habeas data puestos en
-- `src/lib/config.ts` —hoy están en [PENDIENTE]—.
--
-- Una sola RPC escribe la ficha entera, oficios incluidos. No son dos:
-- una ficha a medio guardar es una ficha publicada con datos de una
-- persona y sin lo que ofrece, y eso no puede existir ni un segundo.
--
-- La misma RPC sirve a los dos dueños posibles —cuenta de Google o token
-- de alta asistida— porque el cuerpo es idéntico y lo único que cambia es
-- cómo se resuelve de quién es la ficha. Duplicarla sería garantizar que
-- dentro de un mes una de las dos copias valide menos que la otra.
-- Crear por token no se puede: eso solo ocurre en S3, por un aliado.
--
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Quién es el dueño de esta ficha
--
-- Devuelve el id del proveedor o null. No crea nada y no lanza: quien la
-- llama decide si la ausencia es un alta nueva o un error.
-- ---------------------------------------------------------------------

create or replace function public.proveedor_del_llamante(p_token text default null)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.id
  from public.proveedores p
  where case
          when p_token is not null
            then p.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
          else p.perfil_id = auth.uid() and auth.uid() is not null
        end
  limit 1;
$$;

revoke execute on function public.proveedor_del_llamante(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Guardar la ficha
--
-- `p_oficios` es un arreglo de objetos, uno por oficio:
--   {"oficio_id":"arreglos_ropa","modo":"normal",
--    "precio_desde":15000,"unidad":"prenda"}
--
-- `precio_desde` y `unidad` solo aplican a los modos `solidario` y
-- `normal`; en `gratis` y `aporte` se descartan aquí en vez de dejar que
-- reviente el CHECK, porque el mensaje del CHECK no se le puede enseñar a
-- nadie.
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
  -- ---- Quién guarda -------------------------------------------------
  if p_token is not null and v_id is null then
    raise exception 'Ese enlace no corresponde a ninguna ficha';
  end if;
  if p_token is null and v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;

  -- ---- Consentimiento, antes que nada ------------------------------
  -- Sin esto no hay nada que publicar, así que se comprueba primero: si
  -- falla, no se ha tocado una sola fila.
  if p_acepto_publicacion is not true then
    raise exception 'Tienes que autorizar la publicación de tus datos';
  end if;
  if char_length(trim(coalesce(p_autorizacion_version, ''))) < 3 then
    raise exception 'Falta la versión del texto de autorización';
  end if;

  -- ---- Identidad de la ficha ---------------------------------------
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

  -- ---- Dónde --------------------------------------------------------
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
    -- Mismo trato que `solicitudes.barrio`: es el hueco por donde se
    -- colaría una dirección con teléfono.
    if public.contiene_pii(v_zona) then
      raise exception 'La zona no puede llevar teléfonos ni correos';
    end if;
    if char_length(v_zona) < 2 or char_length(v_zona) > 60 then
      raise exception 'La zona debe tener entre 2 y 60 caracteres';
    end if;
  end if;

  -- ---- Cómo y cuándo -------------------------------------------------
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

  -- ---- Oficios -------------------------------------------------------
  v_n := jsonb_array_length(coalesce(p_oficios, '[]'::jsonb));
  if v_n = 0 then
    raise exception 'Elige al menos un oficio';
  end if;
  -- Tope arbitrario pero no caprichoso: una ficha con veinte oficios no
  -- se lee en un teléfono y huele a que alguien marcó todo.
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

  -- ---- Escribir ------------------------------------------------------
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
      -- Cambiar el teléfono tumba la verificación. Es el punto entero de
      -- la regla V: la marca dice que ALGUIEN llamó a ESE número.
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

  -- Reemplazo completo, como `guardar_ofrecimientos`. Más simple que
  -- reconciliar, y el volumen es de ocho filas.
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

  return v_id;
end;
$$;

revoke execute on function public.guardar_proveedor(
  text,text,text,text,uuid,text,text[],text[],text[],text[],text,jsonb,boolean,text,text)
  from public;
grant execute on function public.guardar_proveedor(
  text,text,text,text,uuid,text,text[],text[],text[],text[],text,jsonb,boolean,text,text)
  to anon, authenticated;

comment on function public.guardar_proveedor(
  text,text,text,text,uuid,text,text[],text[],text[],text[],text,jsonb,boolean,text,text) is
  'Alta y edición de una ficha del directorio de servicios. Con p_token edita la de alta asistida; sin él, la de la cuenta que llama. Crear solo se puede con cuenta: por token se edita lo que ya existe. `anon` puede ejecutarla porque el dueño por token no tiene sesión.';

-- ---------------------------------------------------------------------
-- 3. Leer la propia ficha
--
-- Para la pantalla de edición, que necesita ver lo que la vista pública
-- esconde: si está suspendida, si el teléfono está verificado, y los
-- oficios de riesgo que todavía no se publican.
-- ---------------------------------------------------------------------

create or replace function public.mi_proveedor(p_token text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_id uuid := public.proveedor_del_llamante(p_token);
begin
  if v_id is null then
    return null;
  end if;

  return (
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
      'sin_cuenta', p.token_hash is not null,
      'creado_at', p.creado_at,
      'oficios', coalesce((
        select jsonb_agg(jsonb_build_object(
                 'oficio_id', po.oficio_id,
                 'nombre', c.nombre,
                 'grupo', c.grupo,
                 'riesgo', c.riesgo,
                 'modo', po.modo,
                 'precio_desde', po.precio_desde,
                 'unidad', po.unidad,
                 -- Lo que le explica por qué su oficio no se ve todavía.
                 'publicado', c.riesgo = 'bajo' or (
                   p.telefono_verificado and exists (
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
    from public.proveedores p
    where p.id = v_id
  );
end;
$$;

revoke execute on function public.mi_proveedor(text) from public;
grant  execute on function public.mi_proveedor(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Borrar
--
-- Regla 4: DELETE real. Se lleva por delante los oficios, las
-- referencias, los códigos de servicio y las reseñas, por cascada. Lo
-- único que sobrevive es `accesos_referencia`, que no tiene PII.
--
-- Sin confirmación de nada aquí dentro: la pantalla ya pregunta, y una
-- RPC que se niegue a borrar «por si acaso» convierte el habeas data en
-- una negociación.
-- ---------------------------------------------------------------------

create or replace function public.borrar_proveedor(p_token text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := public.proveedor_del_llamante(p_token);
begin
  if v_id is null then
    raise exception 'No hay ninguna ficha que borrar';
  end if;
  delete from public.proveedores where id = v_id;
end;
$$;

revoke execute on function public.borrar_proveedor(text) from public;
grant  execute on function public.borrar_proveedor(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. La ficha pública, por id
--
-- La vista `proveedores_publicos` no sirve tal cual para la ficha: hacen
-- falta los oficios uno por uno con su precio, y las reseñas. Se resuelve
-- en una llamada y no en cuatro consultas desde el servidor de Next.
-- ---------------------------------------------------------------------

create or replace function public.ficha_proveedor(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'nombre_visible', p.nombre_visible,
    'tipo', p.tipo,
    'telefono', p.telefono,
    'telefono_verificado', p.telefono_verificado,
    'municipio', p.municipio,
    'zona_nombre', p.zona_nombre,
    'zona_texto', p.zona_texto,
    'modalidad', p.modalidad,
    'dias', p.dias,
    'franjas', p.franjas,
    'medios_pago', p.medios_pago,
    'descripcion', p.descripcion,
    'creado_at', p.creado_at,
    'referencias_confirmadas', p.referencias_confirmadas,
    'servicios_confirmados', p.servicios_confirmados,
    'total_resenas', p.total_resenas,
    'cumplimiento', p.cumplimiento,
    'trato', p.trato,
    'puntualidad', p.puntualidad,
    'oficios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'oficio_id', pop.oficio_id,
               'nombre', pop.oficio_nombre,
               'grupo', pop.grupo,
               'modo', pop.modo,
               'precio_desde', pop.precio_desde,
               'unidad', pop.unidad) order by pop.oficio_nombre)
      from public.proveedor_oficios_publicos pop
      where pop.proveedor_id = p.id), '[]'::jsonb),
    'resenas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id,
               'cumplimiento', r.cumplimiento,
               'trato', r.trato,
               'puntualidad', r.puntualidad,
               'comentario', r.comentario,
               'replica', r.replica,
               'creada_at', r.creada_at) order by r.creada_at desc)
      from public.resenas_publicas r
      where r.proveedor_id = p.id), '[]'::jsonb)
  )
  from public.proveedores_publicos p
  where p.id = p_id;
$$;

grant execute on function public.ficha_proveedor(uuid) to anon, authenticated;

comment on function public.ficha_proveedor(uuid) is
  'Lee de proveedores_publicos, no de la tabla: así la regla S y el filtro de suspendidos se aplican una sola vez, en la vista.';

-- ---------------------------------------------------------------------
-- 6. Reportar una ficha o una reseña
--
-- Los dos motivos nuevos son los dos riesgos que el documento fuente
-- nombra en su §7 y que hasta ahora no tenían dónde reportarse: usar una
-- calificación como amenaza, y el sesgo racial o de género.
-- ---------------------------------------------------------------------

create or replace function public.crear_reporte(
  p_tipo_objeto text,
  p_objeto_id   uuid,
  p_motivo      text,
  p_nota        text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_tipo_objeto not in ('solicitud','respuesta','perfil','entidad',
                           'proveedor','resena') then
    raise exception 'Tipo de contenido inválido';
  end if;
  if p_motivo not in ('datos_personales','estafa','contenido_ofensivo',
                      'informacion_falsa','menor_de_edad',
                      'extorsion_resena','discriminacion','otro') then
    raise exception 'Motivo inválido';
  end if;

  insert into public.reportes (tipo_objeto, objeto_id, motivo, nota)
  values (p_tipo_objeto, p_objeto_id, p_motivo, nullif(trim(p_nota), ''));
end;
$$;

grant execute on function public.crear_reporte(text,uuid,text,text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. `modos` en el directorio
--
-- El buscador filtra por modo de precio —quien no puede pagar necesita
-- ver primero lo gratis y lo de aporte—, y la vista no lo traía. Se
-- agrega AL FINAL de la lista de columnas: `create or replace view` no
-- deja insertar en el medio ni renombrar, solo añadir por detrás.
--
-- Sale de `proveedor_oficios_publicos`, igual que `oficios`, para que la
-- regla S se aplique también aquí: el modo de un oficio escondido no
-- puede hacer aparecer al proveedor en un filtro.
-- ---------------------------------------------------------------------

create or replace view public.proveedores_publicos as
select p.id,
       p.nombre_visible,
       p.tipo,
       p.telefono,
       p.telefono_verificado,
       p.municipio,
       p.zona_id,
       z.nombre as zona_nombre,
       p.zona_texto,
       p.modalidad,
       p.dias,
       p.franjas,
       p.medios_pago,
       p.descripcion,
       p.creado_at,
       coalesce(ofi.oficios, '{}') as oficios,
       coalesce(ofi.grupos,  '{}') as grupos,
       coalesce(ref.confirmadas, 0) as referencias_confirmadas,
       coalesce(sp.confirmados,  0) as servicios_confirmados,
       res.cumplimiento,
       res.trato,
       res.puntualidad,
       coalesce(res.total, 0) as total_resenas,
       coalesce(ofi.modos, '{}') as modos
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
  select count(*) as confirmadas
  from public.referencias r
  where r.proveedor_id = p.id and r.estado = 'confirmada'
) ref on true
left join lateral (
  select count(*) as confirmados
  from public.servicios_prestados s
  where s.proveedor_id = p.id and s.confirmado_at is not null
) sp on true
left join lateral (
  select count(*)                       as total,
         round(avg(r.cumplimiento), 1)  as cumplimiento,
         round(avg(r.trato), 1)         as trato,
         round(avg(r.puntualidad), 1)   as puntualidad
  from public.resenas r
  where r.proveedor_id = p.id and not r.oculta
) res on true
where not p.suspendido and p.acepto_publicacion;

grant select on public.proveedores_publicos to anon, authenticated;
