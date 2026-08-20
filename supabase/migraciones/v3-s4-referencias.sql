-- =====================================================================
-- v3 · Fase S4 — Referencias cifradas
--
-- 🔴 Lo más delicado del módulo, y conviene decir por qué antes de leer
-- una línea de SQL: aquí se guarda el nombre y el teléfono de una persona
-- que **no está usando la plataforma**. No la abrió, no la conoce y
-- probablemente no sabe que existe. Lo único que la respalda es la
-- palabra de un tercero —el proveedor— diciendo que le pidió permiso.
--
-- Por eso esto no se parece a `perfiles`, que es publicación consentida,
-- sino a `identidades`: misma llave del Vault, mismo pepper, misma tabla
-- revocada entera, misma bitácora que sobrevive a lo que registra.
--
-- Regla U de PLAN-V3:
--   · Cifrada. Nunca sale en una vista pública.
--   · Lo público es un número: cuántas hay confirmadas.
--   · La autorización se declara, y se guarda su versión y su fecha.
--   · Cada lectura deja rastro, y el rastro sobrevive a la referencia.
--
-- Y una consecuencia que no es negociable: si la fundación no puede
-- sostener las llamadas de comprobación, las referencias se desactivan.
-- Una libreta de teléfonos de gente que no autorizó nada, sin nadie que
-- la use para su finalidad declarada, no tiene defensa.
--
-- Depende de `v2-e1-identidades.sql` (cifrar_texto, descifrar_texto,
-- hash_telefono, normalizar_telefono) y de `v3-s1-esquema.sql`.
--
-- Idempotente.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Quién puede leer una referencia
--
-- Igual que `puede_leer_identidad`: el administrador siempre, y un
-- miembro activo con `puede_ver_identidad` de la organización que dio de
-- alta esa ficha. Ese permiso no se otorga solo —un trigger impide que
-- nazca en `true`— y se reusa a propósito en vez de inventar uno nuevo:
-- quien puede ver la cédula de quien recibe ayuda es la misma clase de
-- persona que puede ver el teléfono de una referencia.
-- ---------------------------------------------------------------------

create or replace function public.puede_leer_referencia(p_referencia_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.es_admin(auth.uid())
      or exists (
        select 1
        from public.referencias r
        join public.proveedores p on p.id = r.proveedor_id
        join public.miembros_organizacion m
          on m.organizacion_id = p.organizacion_id
        join public.organizaciones o on o.id = m.organizacion_id
        where r.id = p_referencia_id
          and m.perfil_id = auth.uid()
          and m.estado = 'activo'
          and m.puede_ver_identidad
          and o.activa
      );
$$;

revoke execute on function public.puede_leer_referencia(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Agregar una referencia
--
-- No descifra y no escribe bitácora: guardar no es leer.
--
-- El tope de tres por ficha no es estético. Cada referencia es el dato
-- personal de alguien que no está aquí, y el §5 del documento dice que
-- el valor de la señal crece con el volumen — pero el costo también, y
-- lo paga un tercero. Tres alcanza para que la señal signifique algo y
-- no convierte esto en una agenda.
-- ---------------------------------------------------------------------

create or replace function public.crear_referencia(
  p_nombre                 text,
  p_telefono               text,
  p_oficio_id              text,
  p_consentimiento_version text,
  p_token                  text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prov   uuid := public.proveedor_del_llamante(p_token);
  v_nombre text := trim(coalesce(p_nombre, ''));
  v_tel    text := trim(coalesce(p_telefono, ''));
  v_id     uuid;
begin
  if v_prov is null then
    raise exception 'No encontramos tu ficha';
  end if;

  if char_length(v_nombre) < 3 or char_length(v_nombre) > 80 then
    raise exception 'El nombre de tu cliente debe tener entre 3 y 80 caracteres';
  end if;
  -- `contiene_pii` marca cualquier corrida de 7 dígitos, así que va sobre
  -- el nombre y NO sobre el teléfono, que es siete dígitos por
  -- definición. Mismo reparto que en `crear_identidad`.
  if public.contiene_pii(v_nombre) then
    raise exception 'En el nombre no va el teléfono: va en su propio campo';
  end if;

  if v_tel !~ '^[0-9+()\- ]{7,20}$' then
    raise exception 'Revisa el teléfono de tu cliente';
  end if;

  if p_oficio_id is not null
     and not exists (select 1 from public.catalogo_oficios c
                      where c.id = p_oficio_id and c.activo) then
    raise exception 'Oficio no válido';
  end if;

  if char_length(trim(coalesce(p_consentimiento_version, ''))) < 3 then
    raise exception 'Falta la versión del texto de consentimiento';
  end if;

  if (select count(*) from public.referencias r where r.proveedor_id = v_prov) >= 3 then
    raise exception 'Puedes tener máximo 3 referencias. Borra una si quieres cambiarla.';
  end if;

  -- Un mismo teléfono no sirve dos veces para la misma ficha: dos
  -- referencias que son la misma persona no son dos señales.
  if exists (select 1 from public.referencias r
              where r.proveedor_id = v_prov
                and r.telefono_hash = public.hash_telefono(v_tel)) then
    raise exception 'Ya pusiste a esa persona como referencia';
  end if;

  insert into public.referencias (
    proveedor_id, nombre_cifrado, telefono_cifrado, telefono_hash,
    oficio_id, consentimiento_version, consentimiento_at)
  values (
    v_prov,
    public.cifrar_texto(v_nombre),
    public.cifrar_texto(v_tel),
    public.hash_telefono(v_tel),
    p_oficio_id,
    trim(p_consentimiento_version),
    now())
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.crear_referencia(text,text,text,text,text) from public;
grant  execute on function public.crear_referencia(text,text,text,text,text) to anon, authenticated;

comment on function public.crear_referencia(text,text,text,text,text) is
  'Regla U. Cifra con la llave del Vault y guarda la versión del texto de consentimiento que el proveedor declaró haber obtenido. `anon` puede ejecutarla porque el dueño por token no tiene sesión.';

-- ---------------------------------------------------------------------
-- 3. Lo que ve el proveedor de sus propias referencias
--
-- Sin descifrar nada. Él sabe a quién puso: no necesita que se lo
-- devolvamos, y devolvérselo obligaría a auditar también esa lectura.
-- Ve el estado, que es lo único que le sirve para saber si su oficio de
-- riesgo ya se está publicando.
-- ---------------------------------------------------------------------

create or replace function public.mis_referencias(p_token text default null)
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
    return '[]'::jsonb;
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'estado', r.estado,
      'oficio_id', r.oficio_id,
      'oficio_nombre', c.nombre,
      'creada_at', r.creada_at,
      'revisada_at', r.revisada_at
    ) order by r.creada_at)
    from public.referencias r
    left join public.catalogo_oficios c on c.id = r.oficio_id
    where r.proveedor_id = v_prov
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.mis_referencias(text) from public;
grant  execute on function public.mis_referencias(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Borrar una referencia
--
-- La puede borrar el proveedor. Y tiene que poder borrarla un
-- administrador, porque la persona referida puede pedir su supresión
-- directamente —sin pasar por el proveedor— y ese es el compromiso de la
-- cláusula séptima del contrato.
--
-- DELETE real. El rastro en `accesos_referencia` se queda, sin PII.
-- ---------------------------------------------------------------------

create or replace function public.borrar_referencia(
  p_id    uuid,
  p_token text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prov uuid := public.proveedor_del_llamante(p_token);
begin
  if not exists (select 1 from public.referencias r where r.id = p_id) then
    raise exception 'Esa referencia no existe';
  end if;

  if not public.es_admin(auth.uid())
     and not exists (select 1 from public.referencias r
                      where r.id = p_id and r.proveedor_id = v_prov
                        and v_prov is not null) then
    raise exception 'No autorizado';
  end if;

  delete from public.referencias where id = p_id;
end;
$$;

revoke execute on function public.borrar_referencia(uuid,text) from public;
grant  execute on function public.borrar_referencia(uuid,text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Leer — la única puerta que descifra
--
-- Escribe la bitácora ANTES de devolver nada. Si el insert falla, no hay
-- datos: es el mismo orden que `leer_identidad`, y es deliberado.
--
-- El motivo se exige antes de comprobar que la referencia exista, para
-- que una llamada sin motivo no sirva ni para sondear qué uuid existen.
-- ---------------------------------------------------------------------

create or replace function public.leer_referencia(
  p_id     uuid,
  p_motivo text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref   public.referencias;
  v_rol   text;
begin
  if char_length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Escribe para qué necesitas verla';
  end if;

  if not public.puede_leer_referencia(p_id) then
    raise exception 'No autorizado';
  end if;

  select * into v_ref from public.referencias where id = p_id;
  if not found then
    raise exception 'Esa referencia no existe';
  end if;

  v_rol := case when public.es_admin(auth.uid()) then 'admin' else 'aliado' end;

  insert into public.accesos_referencia (
    referencia_id, referencia_ref, leida_por, lector_ref, rol_lector,
    motivo, es_prueba)
  values (
    v_ref.id, v_ref.id::text, auth.uid(), coalesce(auth.uid()::text, 'desconocido'),
    v_rol, trim(p_motivo), v_ref.es_prueba);

  return jsonb_build_object(
    'id', v_ref.id,
    'nombre', public.descifrar_texto(v_ref.nombre_cifrado),
    'telefono', public.descifrar_texto(v_ref.telefono_cifrado),
    'estado', v_ref.estado,
    'oficio_id', v_ref.oficio_id,
    'consentimiento_version', v_ref.consentimiento_version,
    'consentimiento_at', v_ref.consentimiento_at
  );
end;
$$;

revoke execute on function public.leer_referencia(uuid,text) from public, anon;
grant  execute on function public.leer_referencia(uuid,text) to authenticated;

comment on function public.leer_referencia(uuid,text) is
  'Regla U. Escribe en accesos_referencia ANTES de descifrar: si la bitácora falla, no se devuelve nada. El motivo se exige antes de comprobar que la referencia exista, para que una llamada sin motivo no sirva ni para sondear uuid.';

-- ---------------------------------------------------------------------
-- 6. Marcar el resultado de la llamada
--
-- No descifra, así que no escribe bitácora: decir «contestó y confirmó»
-- no es haber leído el dato. Quien marca ya lo leyó con `leer_referencia`
-- y esa lectura sí quedó registrada.
--
-- ⚠ Marcar `confirmada` es lo que destapa los oficios de riesgo alto de
-- esa ficha (regla S). No es un cambio de estado cualquiera.
-- ---------------------------------------------------------------------

create or replace function public.marcar_referencia(
  p_id     uuid,
  p_estado text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_estado not in ('pendiente','confirmada','no_contesta','rechazada') then
    raise exception 'Estado inválido';
  end if;

  if not public.puede_leer_referencia(p_id) then
    raise exception 'No autorizado';
  end if;

  update public.referencias
     set estado = p_estado,
         revisada_por = auth.uid(),
         revisada_at = now()
   where id = p_id;
end;
$$;

revoke execute on function public.marcar_referencia(uuid,text) from public, anon;
grant  execute on function public.marcar_referencia(uuid,text) to authenticated;

-- ---------------------------------------------------------------------
-- 7. La cola de muestreo
--
-- Sin PII: de cada referencia solo se dice de qué ficha es y en qué
-- estado está. El nombre y el teléfono se piden uno por uno con
-- `leer_referencia`, que deja rastro. Una lista que los trajera todos
-- convertiría un vistazo a la pantalla en cincuenta accesos sin motivo.
-- ---------------------------------------------------------------------

create or replace function public.referencias_por_revisar()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_admin boolean := public.es_admin(auth.uid());
  v_org   uuid    := public.mi_organizacion_activa();
begin
  if not v_admin and v_org is null then
    raise exception 'No autorizado';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id,
      'estado', r.estado,
      'creada_at', r.creada_at,
      'revisada_at', r.revisada_at,
      'oficio_nombre', c.nombre,
      'proveedor_id', p.id,
      'proveedor_nombre', p.nombre_visible,
      'proveedor_telefono_verificado', p.telefono_verificado,
      -- Si esta persona puede o no destapar el sobre. Se dice aquí para
      -- que la pantalla no ofrezca un botón que va a fallar.
      'puedo_leerla', public.puede_leer_referencia(r.id)
    ) order by (r.estado = 'pendiente') desc, r.creada_at)
    from public.referencias r
    join public.proveedores p on p.id = r.proveedor_id
    left join public.catalogo_oficios c on c.id = r.oficio_id
    where v_admin or p.organizacion_id = v_org
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.referencias_por_revisar() from public, anon;
grant  execute on function public.referencias_por_revisar() to authenticated;

-- ---------------------------------------------------------------------
-- 8. La bitácora, para el panel de administración
--
-- Quién leyó, cuándo y con qué motivo. Nunca qué leyó. Es la evidencia
-- de diligencia frente a la fundación y frente a la SIC, y por eso se
-- puede mirar: una bitácora que nadie revisa no disuade a nadie.
-- ---------------------------------------------------------------------

create or replace function public.accesos_a_referencias()
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

  return coalesce((
    select jsonb_agg(x order by x->>'leida_at' desc)
    from (
      select jsonb_build_object(
        'id', a.id,
        'referencia_ref', a.referencia_ref,
        'existe_todavia', a.referencia_id is not null,
        'lector_ref', a.lector_ref,
        'rol_lector', a.rol_lector,
        'motivo', a.motivo,
        'leida_at', a.leida_at
      ) as x
      from public.accesos_referencia a
      order by a.leida_at desc
      limit 50
    ) s
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.accesos_a_referencias() from public, anon;
grant  execute on function public.accesos_a_referencias() to authenticated;
