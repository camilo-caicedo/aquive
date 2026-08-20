-- =====================================================================
-- v3 · Fase S3 — Alta asistida y verificación del teléfono
--
-- El §8 del documento fuente existe por una razón concreta: buena parte
-- del rebusque no tiene cuenta de Google, y un módulo al que solo se
-- entra con Google excluye justo a quien quiere incluir.
--
-- Así que un miembro activo de una organización aliada puede registrar a
-- alguien. Y al hacerlo **le entrega un token**, que se muestra una sola
-- vez y no se puede recuperar. Ese token no es comodidad: es la puerta de
-- habeas data de una persona que no tiene cuenta. Con él ve, corrige y
-- borra su ficha sin pedirle permiso a la organización que la registró.
-- Sin él, la fundación sería dueña de los datos de otro, que es
-- exactamente lo que la ley no quiere.
--
-- Regla V: nada nace verificado. La marca de teléfono la pone una
-- persona que llamó, igual que hoy se verifica una matrícula. No hay OTP
-- y no se va a traer un proveedor de SMS.
--
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ¿Desde qué organización actúa quien llama?
--
-- Devuelve la organización activa donde es miembro activo, o null. Si
-- pertenece a varias —hoy no pasa, pero el esquema lo permite— devuelve
-- la más antigua, y las RPC de abajo reciben la organización explícita
-- para no tener que adivinar.
-- ---------------------------------------------------------------------

create or replace function public.mi_organizacion_activa()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.organizacion_id
  from public.miembros_organizacion m
  join public.organizaciones o on o.id = m.organizacion_id
  where m.perfil_id = auth.uid()
    and m.estado = 'activo'
    and o.activa
  order by m.creado_at
  limit 1;
$$;

revoke execute on function public.mi_organizacion_activa() from public, anon;
grant  execute on function public.mi_organizacion_activa() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Registrar a alguien que no tiene cuenta
--
-- Devuelve el id de la ficha. El token en claro lo genera el servidor de
-- Next y lo pasa aquí ya hasheado: así esta función nunca tiene que
-- devolverlo, y el token no aparece en ningún registro de Postgres.
--
-- El aliado declara que le leyó el texto de autorización. Es una
-- declaración, igual que la de las referencias, y por eso queda la
-- versión y la fecha: es lo único que se puede enseñar si algún día
-- alguien dice que nunca autorizó nada.
-- ---------------------------------------------------------------------

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
  if p_zona_id is not null and v_zona is not null then
    raise exception 'Elige la zona de la lista o escríbela, no las dos';
  end if;
  if v_zona is not null and public.contiene_pii(v_zona) then
    raise exception 'La zona no puede llevar teléfonos ni correos';
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

  return v_id;
end;
$$;

revoke execute on function public.crear_proveedor_asistido(
  uuid,text,text,text,text,text,uuid,text,text[],jsonb,text) from public, anon;
grant execute on function public.crear_proveedor_asistido(
  uuid,text,text,text,text,text,uuid,text,text[],jsonb,text) to authenticated;

comment on function public.crear_proveedor_asistido(
  uuid,text,text,text,text,text,uuid,text,text[],jsonb,text) is
  'Alta hecha por un miembro de una organización aliada para quien no tiene cuenta. Recibe el token YA hasheado: el token en claro se genera en el servidor de Next, se le entrega a la persona y no vuelve a existir. Pide lo mínimo; el resto lo completa la persona con su enlace.';

-- ---------------------------------------------------------------------
-- 3. Verificar el teléfono — regla V
--
-- Espejo de `verificar_servidor`, con una diferencia: aquí también puede
-- un aliado, porque la verificación la hace quien llama, y quien llama es
-- el equipo de la fundación. Solo sobre fichas que su organización dio de
-- alta: una fundación no verifica los proveedores de otra.
-- ---------------------------------------------------------------------

create or replace function public.verificar_telefono_proveedor(
  p_proveedor_id uuid,
  p_verificado   boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organizacion_id into v_org
  from public.proveedores where id = p_proveedor_id;

  if not found then
    raise exception 'Esa ficha no existe';
  end if;

  if not public.es_admin(auth.uid())
     and not (v_org is not null and public.es_miembro_activo(v_org, auth.uid())) then
    raise exception 'No autorizado';
  end if;

  update public.proveedores
     set telefono_verificado = p_verificado,
         verificado_at  = case when p_verificado then now() else null end,
         verificado_por = case when p_verificado then auth.uid() else null end
   where id = p_proveedor_id;
end;
$$;

revoke execute on function public.verificar_telefono_proveedor(uuid,boolean) from public, anon;
grant  execute on function public.verificar_telefono_proveedor(uuid,boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Suspender — solo administrador
--
-- Espejo de `suspender_perfil`. No la puede un aliado: esconder del
-- directorio a alguien que vive de esto es una decisión de moderación del
-- responsable, no del equipo que lo registró.
-- ---------------------------------------------------------------------

create or replace function public.suspender_proveedor(
  p_proveedor_id uuid,
  p_suspendido   boolean
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

  update public.proveedores
     set suspendido = p_suspendido, actualizado_at = now()
   where id = p_proveedor_id;
end;
$$;

revoke execute on function public.suspender_proveedor(uuid,boolean) from public, anon;
grant  execute on function public.suspender_proveedor(uuid,boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 5. La cola del equipo de la fundación
--
-- Lo que ve un aliado en su pestaña: las fichas de su organización, con
-- lo que la vista pública esconde —si está verificada, si tiene
-- referencias por revisar y qué oficios están esperando las dos cosas—.
--
-- Sin teléfono en claro de las referencias: eso solo sale por
-- `leer_referencia`, que escribe bitácora. Aquí solo se cuenta.
-- ---------------------------------------------------------------------

create or replace function public.proveedores_de_mi_organizacion()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_org uuid := public.mi_organizacion_activa();
begin
  if v_org is null then
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id,
      'nombre_visible', p.nombre_visible,
      'telefono', p.telefono,
      'telefono_verificado', p.telefono_verificado,
      'municipio', p.municipio,
      'suspendido', p.suspendido,
      'creado_at', p.creado_at,
      'oficios', (
        select jsonb_agg(c.nombre order by c.orden)
        from public.proveedor_oficios po
        join public.catalogo_oficios c on c.id = po.oficio_id
        where po.proveedor_id = p.id),
      'referencias_pendientes', (
        select count(*) from public.referencias r
         where r.proveedor_id = p.id and r.estado = 'pendiente'),
      'referencias_confirmadas', (
        select count(*) from public.referencias r
         where r.proveedor_id = p.id and r.estado = 'confirmada'),
      -- Cuántos de sus oficios sigue escondiendo la regla S. Es lo que
      -- le dice al equipo qué falta por hacer.
      'oficios_esperando', (
        select count(*)
        from public.proveedor_oficios po
        join public.catalogo_oficios c on c.id = po.oficio_id
        where po.proveedor_id = p.id
          and c.riesgo = 'alto'
          and not (p.telefono_verificado and exists (
                select 1 from public.referencias r
                 where r.proveedor_id = p.id and r.estado = 'confirmada')))
    ) order by p.telefono_verificado, p.creado_at desc)
    from public.proveedores p
    where p.organizacion_id = v_org
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.proveedores_de_mi_organizacion() from public, anon;
grant  execute on function public.proveedores_de_mi_organizacion() to authenticated;
