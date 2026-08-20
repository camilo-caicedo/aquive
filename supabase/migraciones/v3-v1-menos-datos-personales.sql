-- =====================================================================
-- v3 · Fase V · 1 — la plataforma deja de guardar documentos de identidad
--
-- Decisión del responsable, 20 de agosto de 2026, en el marco del traspaso
-- a Nodo Social. Dos cambios, y los dos apuntan a lo mismo: que la entidad
-- que ahora responde custodie el menor dato personal posible.
--
-- 1 · Se deja de pedir y de guardar el número de documento.
--
--     La verificación de identidad se hace FUERA de la aplicación: la
--     fundación mira la cédula en persona, en su punto, y no la teclea
--     aquí. Eso es a la vez lo bueno y lo malo — la plataforma pierde la
--     capacidad de reconocer a alguien que perdió su enlace, y a cambio
--     deja de custodiar el dato más regulado que tenía.
--
--     ⚠ Esto BORRA los documentos ya guardados, no solo deja de pedirlos.
--     Es irreversible y no hay copia. Se hace así a propósito: mientras
--     esos bytes existan, existe la responsabilidad, aunque el formulario
--     ya no muestre el campo.
--
--     Lo que sobrevive de `identidades`: nombre y teléfono, cifrados como
--     siempre, que es lo que la fundación necesita para coordinar una
--     entrega. Y `accesos_identidad` entero, que es la prueba de quién
--     miró qué y cuándo.
--
--     La regla O —sin datos de menores— deja de necesitar su CHECK de
--     tipos de documento: sin documento no hay dónde meter una TI.
--
-- 2 · Ninguna ficha del directorio se publica sin que alguien haya
--     llamado.
--
--     Hasta ahora `telefono_verificado` solo decidía la visibilidad de los
--     oficios de riesgo alto (regla S). Pasa a decidir la de toda la
--     ficha: cualquiera puede registrarse y describir lo que hace, pero
--     nada de eso se ve hasta que una persona de la fundación llamó a ese
--     número y confirmó que contesta quien dice ser.
--
--     Se aplica también a las que ya estaban publicadas. Es lo único que
--     permite que la página diga, sin mentir, que todo lo que se ve pasó
--     por una persona.
--
-- Cambian de firma tres funciones —`crear_identidad`,
-- `activar_acompanamiento` y las dos que devolvían el documento— y
-- desaparece una. La interfaz cambia en el mismo despliegue.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Las columnas del documento se vacían y dejan de ser obligatorias
--
-- No se hace `drop column`: dejarlas anulables y vaciarlas borra el dato
-- igual, y deja la tabla legible para quien venga a auditar qué había
-- antes. Si algún día se quiere el `drop`, es una línea y ya no destruye
-- nada porque no queda nada dentro.
-- ---------------------------------------------------------------------

alter table public.identidades
  alter column documento_tipo     drop not null,
  alter column documento_cifrado  drop not null,
  alter column documento_hash     drop not null,
  alter column documento_ultimos4 drop not null;

update public.identidades
   set documento_tipo     = null,
       documento_cifrado  = null,
       documento_hash     = null,
       documento_ultimos4 = null
 where documento_cifrado is not null
    or documento_hash is not null
    or documento_ultimos4 is not null
    or documento_tipo is not null;

-- El índice existía para cruzar a la misma persona entre solicitudes. Sin
-- hash no cruza nada.
drop index if exists public.idx_identidades_documento_hash;

comment on table public.identidades is
  'CIFRADA. Regla K de PLAN-V2, sin documento desde v3-v1: guarda nombre y teléfono y nada más. La tabla está revocada entera y la única puerta son crear_identidad y leer_identidad, que escribe bitácora ANTES de devolver.';

-- ---------------------------------------------------------------------
-- 2 · Crear una identidad, sin documento
-- ---------------------------------------------------------------------

drop function if exists public.crear_identidad(text,text,text,text,text,text,uuid,uuid);

create or replace function public.crear_identidad(
  p_titular_tipo         text,
  p_nombre               text,
  p_autorizacion_version text,
  p_telefono             text default null,
  p_solicitud_id         uuid default null,
  p_perfil_id            uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tel    text := public.normalizar_telefono(p_telefono);
  v_prueba boolean := false;
  v_id     uuid;
begin
  if p_titular_tipo not in ('solicitante','ofertador','aliado') then
    raise exception 'Tipo de titular inválido';
  end if;

  if num_nonnulls(p_solicitud_id, p_perfil_id) <> 1 then
    raise exception 'La identidad cuelga de una solicitud o de un perfil, exactamente de uno';
  end if;

  if p_titular_tipo = 'solicitante' and p_solicitud_id is null then
    raise exception 'La identidad de quien pide ayuda cuelga de su solicitud';
  end if;

  if p_titular_tipo in ('ofertador','aliado') and p_perfil_id is null then
    raise exception 'Esa identidad cuelga de un perfil';
  end if;

  if char_length(trim(coalesce(p_nombre, ''))) not between 3 and 80 then
    raise exception 'El nombre debe tener entre 3 y 80 caracteres';
  end if;

  -- Un nombre no lleva ni arroba ni siete dígitos seguidos. Es el atajo de
  -- quien pega un número entero en la casilla equivocada — y ahora importa
  -- más que antes, porque ya no hay ninguna casilla legítima donde
  -- escribir un documento.
  if public.contiene_pii(p_nombre) then
    raise exception 'Escribe solo el nombre, sin números ni correos';
  end if;

  if char_length(trim(coalesce(p_autorizacion_version, ''))) not between 3 and 40 then
    raise exception 'Falta la versión de la autorización';
  end if;

  if p_solicitud_id is not null then
    select s.es_prueba into v_prueba from public.solicitudes s where s.id = p_solicitud_id;
  end if;

  insert into public.identidades (
    solicitud_id, perfil_id, titular_tipo,
    nombre_cifrado, telefono_cifrado, telefono_hash,
    autorizacion_version, es_prueba)
  values (
    p_solicitud_id, p_perfil_id, p_titular_tipo,
    public.cifrar_texto(trim(p_nombre)),
    case when v_tel is null then null else public.cifrar_texto(v_tel) end,
    case when v_tel is null then null else public.hash_con_pepper(v_tel) end,
    trim(p_autorizacion_version), coalesce(v_prueba, false))
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.crear_identidad(text,text,text,text,uuid,uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 3 · Activar el acompañamiento, sin documento
-- ---------------------------------------------------------------------

drop function if exists public.activar_acompanamiento(text,uuid,text,text,text,text,text);

create or replace function public.activar_acompanamiento(
  p_token                text,
  p_organizacion_id      uuid,
  p_nombre               text,
  p_autorizacion_version text,
  p_telefono             text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sol public.solicitudes;
  v_org public.organizaciones;
begin
  select * into v_sol from public.solicitudes s
   where s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and public.estado_activo(s.estado)
     and s.expira_at > now();

  if v_sol.id is null then
    raise exception 'Solicitud no encontrada o vencida';
  end if;

  if v_sol.flujo = 'acompanado' then
    raise exception 'Esta solicitud ya tiene acompañamiento';
  end if;

  select * into v_org from public.organizaciones o
   where o.id = p_organizacion_id and o.activa;

  if v_org.id is null then
    raise exception 'Esa organización no está disponible';
  end if;

  -- Que la fundación trabaje donde está la solicitud. Sin esto, quien
  -- conozca un identificador de organización podría colgarle solicitudes
  -- de cualquier parte del país.
  if not (v_sol.municipio = any(v_org.municipios)) then
    raise exception 'Esa organización no trabaja en el municipio de esta solicitud';
  end if;

  -- Primero la identidad: si algo de esto falla, la solicitud no llega a
  -- marcarse y se queda como estaba.
  perform public.crear_identidad(
    'solicitante', p_nombre, p_autorizacion_version, p_telefono, v_sol.id, null);

  update public.solicitudes
     set flujo = 'acompanado',
         organizacion_id = v_org.id,
         acompanamiento_at = now()
   where id = v_sol.id;

  return jsonb_build_object(
    'codigo',       v_sol.codigo,
    'organizacion', v_org.nombre
  );
end;
$$;

grant execute on function public.activar_acompanamiento(text,uuid,text,text,text)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4 · Lo que se lee deja de traer documento
-- ---------------------------------------------------------------------

create or replace function public.leer_identidad(p_id uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fila public.identidades;
begin
  if char_length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Escribe para qué necesitas ver estos datos';
  end if;

  if not public.puede_leer_identidad(p_id) then
    raise exception 'No autorizado';
  end if;

  select * into v_fila from public.identidades i where i.id = p_id;

  -- ANTES de devolver, no después: si la escritura de la bitácora falla,
  -- la lectura no ocurre.
  perform public.registrar_acceso_identidad(p_id, p_motivo, v_fila.es_prueba);

  return jsonb_build_object(
    'id',                 v_fila.id,
    'titular_tipo',       v_fila.titular_tipo,
    'nombre',             public.descifrar_texto(v_fila.nombre_cifrado),
    'telefono',           public.descifrar_texto(v_fila.telefono_cifrado),
    'autorizacion_version', v_fila.autorizacion_version,
    'autorizacion_at',    v_fila.autorizacion_at
  );
end;
$$;

revoke execute on function public.leer_identidad(uuid,text) from public, anon;
grant  execute on function public.leer_identidad(uuid,text) to authenticated;

-- La planilla que se firma en el acopio: nombre, teléfono y qué se
-- entregó. Quien la recibe comprueba la cédula MIRÁNDOLA, que es lo que
-- hacía de todos modos.
create or replace function public.exportar_planilla(p_conversacion_id uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv  public.conversaciones;
  v_ident public.identidades;
  v_datos jsonb;
begin
  if char_length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Escribe para qué necesitas la planilla';
  end if;

  select * into v_conv from public.conversaciones c where c.id = p_conversacion_id;
  if v_conv.id is null then
    raise exception 'Conversación no encontrada';
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
    'telefono',       public.descifrar_texto(v_ident.telefono_cifrado),
    'autorizacion_version', v_ident.autorizacion_version,
    'autorizacion_at',      v_ident.autorizacion_at,
    'entregas',       coalesce(v_datos, '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.exportar_planilla(uuid,text) from public, anon;
grant  execute on function public.exportar_planilla(uuid,text) to authenticated;

-- ---------------------------------------------------------------------
-- 5 · Buscar por cédula en el acopio: se elimina
--
-- Existía para quien llegaba al punto habiendo perdido su enlace: decía su
-- cédula y esto la hasheaba con el pepper y buscaba. Sin documento
-- guardado no hay con qué buscar, y su única alternativa —el código de la
-- conversación— ya existe y es opaca por construcción.
-- ---------------------------------------------------------------------

drop function if exists public.buscar_identidad_presencial(text,text);

-- ---------------------------------------------------------------------
-- 6 · Nada se publica sin que alguien haya llamado
--
-- La regla S seguía viva y sigue donde estaba, dentro de
-- `proveedor_oficios_publicos`: un oficio de riesgo alto necesita ADEMÁS
-- una referencia confirmada. Lo que se añade aquí es el piso para todos.
-- ---------------------------------------------------------------------

create or replace view public.proveedores_publicos as
select
  p.id,
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
  coalesce(ofi.oficios, '{}'::text[]) as oficios,
  coalesce(ofi.grupos, '{}'::text[]) as grupos,
  coalesce(ref.confirmadas, 0::bigint) as referencias_confirmadas,
  coalesce(sp.confirmados, 0::bigint) as servicios_confirmados,
  res.cumplimiento,
  res.trato,
  res.puntualidad,
  coalesce(res.total, 0::bigint) as total_resenas,
  coalesce(ofi.modos, '{}'::text[]) as modos
from public.proveedores p
  left join public.zonas z on z.id = p.zona_id
  join lateral (
    select array_agg(distinct pop.oficio_id) as oficios,
           array_agg(distinct pop.grupo)     as grupos,
           array_agg(distinct pop.modo)      as modos
      from public.proveedor_oficios_publicos pop
     where pop.proveedor_id = p.id) ofi on ofi.oficios is not null
  left join lateral (
    select count(*) as confirmadas
      from public.referencias r
     where r.proveedor_id = p.id and r.estado = 'confirmada') ref on true
  left join lateral (
    select count(*) as confirmados
      from public.servicios_prestados s
     where s.proveedor_id = p.id and s.confirmado_at is not null) sp on true
  left join lateral (
    select count(*) as total,
           round(avg(r.cumplimiento), 1) as cumplimiento,
           round(avg(r.trato), 1)        as trato,
           round(avg(r.puntualidad), 1)  as puntualidad
      from public.resenas r
     where r.proveedor_id = p.id and not r.oculta) res on true
where not p.suspendido
  and p.acepto_publicacion
  -- El piso nuevo: sin llamada, no hay ficha.
  and p.telefono_verificado;

grant select on public.proveedores_publicos to anon, authenticated;

-- Comprobar:
--   select count(*) from public.identidades where documento_cifrado is not null;  -- 0
--   select count(*) from public.proveedores_publicos;
--   select public.activar_acompanamiento('<token>', '<org>', 'Nombre', '20 de agosto de 2026', '3001234567');
