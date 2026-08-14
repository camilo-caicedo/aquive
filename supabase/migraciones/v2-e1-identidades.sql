-- =====================================================================
-- v2 · Fase E — Identidad cifrada
--
-- 🔴 Esta es la migración que trae datos personales de verdad al proyecto:
-- nombre, documento y teléfono de una persona. Todo lo anterior era
-- deliberadamente anónimo. Antes de que esto se use contra producción
-- tienen que estar los cuatro papeles de PLAN-V2 §12: el contrato de
-- transmisión de datos con la fundación (art. 25 del Decreto 1377 de
-- 2013), el registro en el RNBD, el canal de habeas data y el texto de
-- autorización revisado. Crear las tablas no es empezar a recolectar; la
-- recolección empieza en la Fase F, cuando existe la pantalla.
--
-- Reglas que implementa (PLAN-V2 §2):
--   K · La identidad vive cifrada, aislada y con fecha de muerte. Cuelga
--       de la solicitud o del perfil, y muere con ellos.
--   N · Cada lectura deja rastro, y ese rastro SOBREVIVE al borrado de la
--       identidad. Sin PII: uuid, quién, cuándo, con qué motivo.
--   O · Sin datos de menores. TI y RC prohibidos por CHECK, no por UI.
--   P · El documento se hashea con pepper del Vault. Una cédula tiene
--       ~10 dígitos: un sha256 pelado se rompe por fuerza bruta con un
--       volcado de la base.
--
-- Sin interfaz. Nada de esto se llama todavía desde una pantalla.
--
-- Idempotente. Se puede volver a correr.
--
-- ---------------------------------------------------------------------
-- ANTES DE CORRER ESTO: los dos secretos del Vault
-- ---------------------------------------------------------------------
--
-- En el dashboard, Project Settings → Vault → New secret. Dos:
--
--   aquive_identidad_key      llave simétrica de pgp_sym_encrypt
--   aquive_documento_pepper   pepper del hash de documento (regla P)
--
-- Genera cada valor con 32 bytes aleatorios, por ejemplo
-- `openssl rand -base64 32`, y NO lo guardes en el repositorio, ni en
-- .env, ni en un mensaje. El Vault es el único sitio.
--
-- ⚠ Dos cosas que cuestan una tarde si no se saben:
--
--   1. En Supabase gestionado el vault YA VIENE INSTALADO. Si
--      `vault.decrypted_secrets` falla, el problema es de permisos del rol
--      dueño de la función, no de una extensión ausente.
--   2. `security definer` por sí solo NO basta: la función corre como su
--      dueño, así que tiene que ser propiedad de un rol con acceso al
--      vault. Si creas estas funciones desde otro rol, `secreto_vault`
--      devolverá NULL y `cifrar_texto` reventará con el mensaje de abajo
--      — que es justo lo que tiene que pasar, en vez de guardar NULL.
--
-- 🔴 Si se pierde `aquive_identidad_key`, lo cifrado no se recupera. Si se
-- cambia `aquive_documento_pepper`, todos los hashes existentes dejan de
-- coincidir y `buscar_identidad_presencial` deja de encontrar nada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Los ayudantes de cifrado
--
-- Los cinco van con el EXECUTE revocado a todo el mundo, `anon` y
-- `authenticated` incluidos. Solo se llaman desde las RPC de más abajo,
-- que corren como dueñas. Nadie descifra nada por su cuenta.
--
-- `extensions.pgp_sym_encrypt` con prefijo, no `pgp_sym_encrypt` a secas:
-- las funciones llevan `set search_path = ''` y pgcrypto vive en
-- `extensions`. Mismo precedente que `extensions.digest` en el resto del
-- esquema.
-- ---------------------------------------------------------------------

create or replace function public.secreto_vault(p_nombre text)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select s.decrypted_secret from vault.decrypted_secrets s where s.name = p_nombre;
$$;

-- Normalizadores. Van aparte y son `immutable` porque el hash tiene que
-- salir igual al guardar y al buscar: si «1.020.304-5» y «10203045» no se
-- normalizan igual, `buscar_identidad_presencial` no encuentra a nadie y
-- nadie entiende por qué.
create or replace function public.normalizar_documento(p_documento text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_documento, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

create or replace function public.normalizar_telefono(p_telefono text)
returns text
language sql
immutable
set search_path = ''
as $$
  -- Fuera el indicativo del país: la misma persona escribe +57 300…,
  -- 57300… y 300… según el día, y las tres son el mismo teléfono.
  select regexp_replace(
           regexp_replace(coalesce(p_telefono, ''), '[^0-9]', '', 'g'),
           '^57(?=[0-9]{10}$)', '');
$$;

create or replace function public.cifrar_texto(p_texto text)
returns bytea
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_llave text := public.secreto_vault('aquive_identidad_key');
begin
  if p_texto is null then
    return null;
  end if;
  -- Revienta en vez de guardar NULL. Un cifrado que falla en silencio
  -- deja una fila que parece completa y no lo está.
  if v_llave is null then
    raise exception 'Falta el secreto aquive_identidad_key en el Vault, o la función no es propiedad de un rol con acceso a él';
  end if;
  return extensions.pgp_sym_encrypt(p_texto, v_llave);
end;
$$;

create or replace function public.descifrar_texto(p_dato bytea)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_llave text := public.secreto_vault('aquive_identidad_key');
begin
  if p_dato is null then
    return null;
  end if;
  if v_llave is null then
    raise exception 'Falta el secreto aquive_identidad_key en el Vault, o la función no es propiedad de un rol con acceso a él';
  end if;
  return extensions.pgp_sym_decrypt(p_dato, v_llave);
end;
$$;

-- Regla P. El pepper vive en el Vault y nunca en el repositorio.
create or replace function public.hash_con_pepper(p_texto text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pepper text := public.secreto_vault('aquive_documento_pepper');
begin
  if coalesce(p_texto, '') = '' then
    return null;
  end if;
  if v_pepper is null then
    raise exception 'Falta el secreto aquive_documento_pepper en el Vault';
  end if;
  return encode(extensions.digest(p_texto || v_pepper, 'sha256'), 'hex');
end;
$$;

create or replace function public.hash_documento(p_documento text)
returns text
language sql
security definer
set search_path = ''
as $$
  select public.hash_con_pepper(public.normalizar_documento(p_documento));
$$;

create or replace function public.hash_telefono(p_telefono text)
returns text
language sql
security definer
set search_path = ''
as $$
  select public.hash_con_pepper(public.normalizar_telefono(p_telefono));
$$;

revoke execute on function public.secreto_vault(text)       from public, anon, authenticated;
revoke execute on function public.cifrar_texto(text)        from public, anon, authenticated;
revoke execute on function public.descifrar_texto(bytea)    from public, anon, authenticated;
revoke execute on function public.hash_con_pepper(text)     from public, anon, authenticated;
revoke execute on function public.hash_documento(text)      from public, anon, authenticated;
revoke execute on function public.hash_telefono(text)       from public, anon, authenticated;
revoke execute on function public.normalizar_documento(text) from public, anon, authenticated;
revoke execute on function public.normalizar_telefono(text)  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. `identidades`
--
-- ⚠ LA LLAVE FORÁNEA VA DE AQUÍ HACIA AFUERA, nunca al revés (§5.7-1).
-- El instinto es poner `solicitudes.identidad_id`; está mal: un CASCADE
-- ahí significa «si borro la identidad, borro la solicitud», y borrar la
-- solicitud dejaría la identidad huérfana, cifrada y para siempre — lo
-- contrario exacto de la regla K.
--
-- Dos ciclos de vida distintos, y hay que decírselo a cada quien:
--   · La del solicitante cuelga de la solicitud y muere con ella, a las
--     72 horas o cuando la cierre.
--   · La del ofertador o el aliado cuelga de su perfil y vive mientras
--     tenga cuenta. Al pedírsela hay que decir exactamente eso.
-- ---------------------------------------------------------------------

create table if not exists public.identidades (
  id                 uuid primary key default gen_random_uuid(),
  solicitud_id       uuid references public.solicitudes(id) on delete cascade,
  perfil_id          uuid references public.perfiles(id)    on delete cascade,
  titular_tipo       text not null
                       check (titular_tipo in ('solicitante','ofertador','aliado')),
  nombre_cifrado     bytea not null,
  -- Regla O: sin datos de menores. TI y RC no se enumeran en ninguna
  -- parte del producto, y aquí quedan fuera por CHECK — no por una
  -- validación de interfaz que mañana alguien cambia sin darse cuenta.
  documento_tipo     text not null check (documento_tipo in ('CC','CE','PEP','PPT')),
  documento_cifrado  bytea not null,
  -- Regla P: sha256(documento normalizado || pepper del Vault).
  documento_hash     text not null,
  -- En claro y a propósito (§5.6): es para que el aliado reconozca a quién
  -- tiene enfrente sin descifrar nada. Cuatro dígitos no identifican a
  -- nadie por sí solos, pero NO pueden aparecer en pantallas públicas, ni
  -- en un QR, ni en una URL (regla 6).
  documento_ultimos4 text not null check (documento_ultimos4 ~ '^[A-Z0-9]{1,4}$'),
  telefono_cifrado   bytea,
  telefono_hash      text,
  -- Qué versión del texto de autorización aceptó, y cuándo. Es la prueba
  -- de que hubo consentimiento informado, y sin ella el tratamiento no se
  -- puede defender.
  autorizacion_version text not null check (char_length(trim(autorizacion_version)) between 3 and 40),
  autorizacion_at    timestamptz not null default now(),
  creada_at          timestamptz not null default now(),
  -- La deriva `crear_identidad` de la solicitud o del perfil del que
  -- cuelga. No es por esta tabla —se va con ellos por CASCADE— sino por
  -- `accesos_identidad`, que sobrevive y hay que poder limpiar.
  es_prueba          boolean not null default false,
  constraint identidades_uno_u_otro
    check (num_nonnulls(solicitud_id, perfil_id) = 1),
  constraint identidades_titular_coherente check (
    (titular_tipo = 'solicitante'          and solicitud_id is not null)
    or (titular_tipo in ('ofertador','aliado') and perfil_id is not null)
  )
);

comment on table public.identidades is
  'CIFRADA. Regla K de PLAN-V2. Ninguna vista pública la toca y ninguna consulta del cliente la alcanza: la tabla está revocada entera y la única puerta son crear_identidad, leer_identidad y buscar_identidad_presencial. Las dos que descifran escriben bitácora ANTES de devolver.';

comment on column public.identidades.documento_ultimos4 is
  'En claro a propósito, ver PLAN-V2 §5.6. Nunca en una pantalla pública, ni en un QR, ni en una URL.';

-- Una identidad por solicitud y una por perfil. Índices parciales y no
-- UNIQUE de tabla: un UNIQUE no admite WHERE, y sin él los NULL de la
-- columna que no aplica no se comparan entre sí. Mismo criterio que
-- `ofrecimientos`.
create unique index if not exists identidades_solicitud_uniq
  on public.identidades(solicitud_id) where solicitud_id is not null;
create unique index if not exists identidades_perfil_uniq
  on public.identidades(perfil_id) where perfil_id is not null;

-- Sin UNIQUE sobre el hash a propósito: la misma persona puede tener una
-- identidad colgada de su perfil de ofertador y otra colgada de una
-- solicitud suya, y un UNIQUE global le impediría pedir ayuda.
create index if not exists idx_identidades_documento_hash
  on public.identidades(documento_hash);

-- ---------------------------------------------------------------------
-- 3. `accesos_identidad` — la bitácora que SOBREVIVE
--
-- Regla N. Es la evidencia de diligencia frente a la fundación y frente a
-- la SIC, así que no puede irse con lo que registra: `identidad_id` y
-- `leida_por` van en ON DELETE SET NULL, y al lado va una copia en texto
-- del uuid para que la fila siga diciendo algo cuando la fila madre ya no
-- exista. Mismo razonamiento que `servidores.verificado_por`.
--
-- Sin PII: aquí no hay nombres, ni documentos, ni teléfonos. Solo uuid,
-- quién leyó, cuándo y con qué motivo.
-- ---------------------------------------------------------------------

create table if not exists public.accesos_identidad (
  id            uuid primary key default gen_random_uuid(),
  identidad_id  uuid references public.identidades(id) on delete set null,
  identidad_ref text not null,
  leida_por     uuid references auth.users(id) on delete set null,
  lector_ref    text not null,
  rol_lector    text not null check (rol_lector in ('admin','aliado')),
  -- Obligatorio y con longitud mínima: «consulta» no es un motivo. Si el
  -- motivo se pudiera dejar vacío, la bitácora contaría accesos y no
  -- diligencia.
  motivo        text not null check (char_length(trim(motivo)) between 5 and 200),
  leida_at      timestamptz not null default now(),
  es_prueba     boolean not null default false
);

comment on table public.accesos_identidad is
  'Regla N: cada lectura de identidad deja rastro, y el rastro sobrevive al borrado de la identidad. Sin PII. Nadie tiene UPDATE ni DELETE sobre esta tabla, ni siquiera el administrador: se escribe una vez y no se toca.';

create index if not exists idx_accesos_identidad
  on public.accesos_identidad(identidad_id, leida_at desc);

-- ---------------------------------------------------------------------
-- 4. RLS — revocadas enteras, cero políticas
--
-- Igual que `solicitudes` y que las tres tablas de la Fase D: la frontera
-- son las RPC. Aquí además es lo único aceptable — un `select` sobre
-- `identidades`, aunque devolviera solo bytea, sería un volcado del
-- material cifrado, que es la mitad del trabajo de quien quiera romperlo.
-- ---------------------------------------------------------------------

alter table public.identidades       enable row level security;
alter table public.accesos_identidad enable row level security;

revoke all on public.identidades       from anon, authenticated;
revoke all on public.accesos_identidad from anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Crear
--
-- No descifra y no escribe bitácora: guardar no es leer. La llama el
-- servidor con la llave de servicio, como `destinatarios_aviso` — por eso
-- no lleva `grant` a `authenticated`.
-- ---------------------------------------------------------------------

create or replace function public.crear_identidad(
  p_titular_tipo         text,
  p_nombre               text,
  p_documento_tipo       text,
  p_documento            text,
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
  v_doc      text := public.normalizar_documento(p_documento);
  v_tel      text := public.normalizar_telefono(p_telefono);
  v_prueba   boolean := false;
  v_id       uuid;
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

  -- Un nombre no lleva ni arroba ni siete dígitos seguidos. Es el atajo
  -- de quien pega la cédula entera en la casilla equivocada.
  if public.contiene_pii(p_nombre) then
    raise exception 'Escribe solo el nombre, sin números ni correos';
  end if;

  -- Regla O. El CHECK de la tabla ya lo impide; esto es para que salga un
  -- mensaje que se entienda, igual que `crear_item_catalogo` con la
  -- categoría.
  if p_documento_tipo in ('TI','RC') then
    raise exception 'Esta plataforma no recibe documentos de menores de edad';
  end if;

  if p_documento_tipo not in ('CC','CE','PEP','PPT') then
    raise exception 'Tipo de documento inválido';
  end if;

  if v_doc !~ '^[A-Z0-9]{5,20}$' then
    raise exception 'El número de documento va entre 5 y 20 caracteres, sin espacios ni signos';
  end if;

  if p_telefono is not null and v_tel !~ '^[0-9]{7,10}$' then
    raise exception 'El teléfono va entre 7 y 10 dígitos';
  end if;

  if char_length(trim(coalesce(p_autorizacion_version, ''))) < 3 then
    raise exception 'Falta la versión del texto de autorización que aceptó la persona';
  end if;

  -- La marca de prueba se hereda de aquello de lo que cuelga, no llega por
  -- parámetro: `accesos_identidad` sobrevive al borrado y hay que poder
  -- limpiarla después.
  if p_solicitud_id is not null then
    select s.es_prueba into v_prueba
      from public.solicitudes s where s.id = p_solicitud_id;
    if v_prueba is null then
      raise exception 'Esa solicitud no existe';
    end if;
  else
    select p.nombre_visible ilike 'prueba%' into v_prueba
      from public.perfiles p where p.id = p_perfil_id;
    if v_prueba is null then
      raise exception 'Ese perfil no existe';
    end if;
  end if;

  -- Corregir un dígito mal escrito no puede exigir borrar la solicitud, así
  -- que primero se intenta actualizar. Va como update explícito y no como
  -- `on conflict`: los índices únicos son dos y parciales, y un
  -- `on conflict` tendría que nombrar uno de los dos — el que no toca
  -- reventaría con un error crudo de índice duplicado.
  --
  -- El update REEMPLAZA todo, teléfono incluido: si llega sin teléfono, el
  -- que hubiera se borra. Es lo que corresponde a un formulario que se
  -- vuelve a enviar entero, y del lado de guardar menos dato nunca es el
  -- error grave.
  update public.identidades set
    titular_tipo         = p_titular_tipo,
    nombre_cifrado       = public.cifrar_texto(trim(p_nombre)),
    documento_tipo       = p_documento_tipo,
    documento_cifrado    = public.cifrar_texto(v_doc),
    documento_hash       = public.hash_documento(v_doc),
    documento_ultimos4   = right(v_doc, 4),
    telefono_cifrado     = public.cifrar_texto(nullif(v_tel, '')),
    telefono_hash        = public.hash_telefono(v_tel),
    autorizacion_version = trim(p_autorizacion_version),
    autorizacion_at      = now()
  where (p_solicitud_id is not null and solicitud_id = p_solicitud_id)
     or (p_perfil_id    is not null and perfil_id    = p_perfil_id)
  returning id into v_id;

  if v_id is null then
    insert into public.identidades (
      solicitud_id, perfil_id, titular_tipo,
      nombre_cifrado, documento_tipo, documento_cifrado, documento_hash,
      documento_ultimos4, telefono_cifrado, telefono_hash,
      autorizacion_version, autorizacion_at, es_prueba)
    values (
      p_solicitud_id, p_perfil_id, p_titular_tipo,
      public.cifrar_texto(trim(p_nombre)),
      p_documento_tipo,
      public.cifrar_texto(v_doc),
      public.hash_documento(v_doc),
      right(v_doc, 4),
      public.cifrar_texto(nullif(v_tel, '')),
      public.hash_telefono(v_tel),
      trim(p_autorizacion_version), now(), v_prueba)
    returning id into v_id;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.crear_identidad(text,text,text,text,text,text,uuid,uuid)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Quién puede leer
--
-- HOY: solo un administrador.
--
-- El camino del aliado necesita saber a QUÉ organización pertenece la
-- identidad, y esa columna —`solicitudes.organizacion_id`— llega en la
-- Fase F. Mientras no exista, conceder por «es aliado con permiso en
-- alguna organización» dejaría que cualquier fundación leyera las cédulas
-- de las demás, que es exactamente lo que la regla K existe para impedir.
--
-- Cuando llegue la Fase F, esta es la única función que hay que tocar:
-- admin, o miembro activo con `puede_ver_identidad` de la organización
-- que acompaña esa solicitud.
-- ---------------------------------------------------------------------

create or replace function public.puede_leer_identidad(p_identidad_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select public.es_admin(auth.uid())
     and exists (select 1 from public.identidades i where i.id = p_identidad_id);
$$;

revoke execute on function public.puede_leer_identidad(uuid) from public, anon, authenticated;

-- La bitácora se escribe SIEMPRE por aquí, y con las copias de texto
-- puestas: son las que hacen que la fila siga significando algo cuando la
-- identidad y la cuenta que la leyó ya no existan.
create or replace function public.registrar_acceso_identidad(
  p_identidad_id uuid,
  p_motivo       text,
  p_es_prueba    boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  insert into public.accesos_identidad
    (identidad_id, identidad_ref, leida_por, lector_ref, rol_lector, motivo, es_prueba)
  values (
    p_identidad_id,
    coalesce(p_identidad_id::text, 'sin-coincidencia'),
    v_uid,
    coalesce(v_uid::text, 'sin-sesion'),
    case when public.es_admin(v_uid) then 'admin' else 'aliado' end,
    trim(p_motivo),
    p_es_prueba);
end;
$$;

revoke execute on function public.registrar_acceso_identidad(uuid,text,boolean)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Leer — descifra, y deja rastro antes de devolver
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
  -- El motivo va primero: si falta, no se mira siquiera si existe la
  -- identidad. Así una llamada sin motivo tampoco sirve para averiguar
  -- qué uuid existen.
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
    'documento_tipo',     v_fila.documento_tipo,
    'documento',          public.descifrar_texto(v_fila.documento_cifrado),
    'telefono',           public.descifrar_texto(v_fila.telefono_cifrado),
    'autorizacion_version', v_fila.autorizacion_version,
    'autorizacion_at',    v_fila.autorizacion_at
  );
end;
$$;

revoke execute on function public.leer_identidad(uuid,text) from public, anon;
grant  execute on function public.leer_identidad(uuid,text) to authenticated;

-- ---------------------------------------------------------------------
-- 8. Buscar a quien llegó al acopio (F10)
--
-- Alguien llega al punto de acopio y perdió el enlace de su solicitud.
-- Dice su cédula, y esto la hashea con el pepper y busca. NO descifra
-- nada: devuelve el código de la solicitud y los cuatro últimos dígitos,
-- que es lo que hace falta para seguir, y ni un dato más.
--
-- Deja rastro incluso cuando no encuentra nada: una búsqueda a ciegas
-- contra veinte cédulas también es un acceso, y es justo la que hay que
-- poder ver después.
-- ---------------------------------------------------------------------

create or replace function public.buscar_identidad_presencial(
  p_documento text,
  p_motivo    text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash  text;
  v_res   jsonb := '[]'::jsonb;
  v_fila  record;
  v_hubo  boolean := false;
begin
  if char_length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Escribe para qué necesitas buscar a esta persona';
  end if;

  -- Sin identidad concreta todavía, así que el permiso se pregunta sobre
  -- el que sí se puede: administrador. Cuando la Fase F traiga la
  -- organización, esto pasa a filtrar por sus solicitudes.
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  if public.normalizar_documento(p_documento) !~ '^[A-Z0-9]{5,20}$' then
    raise exception 'El número de documento va entre 5 y 20 caracteres';
  end if;

  v_hash := public.hash_documento(p_documento);

  for v_fila in
    select i.id, i.titular_tipo, i.documento_ultimos4, i.es_prueba,
           (select s.codigo from public.solicitudes s where s.id = i.solicitud_id) as solicitud_codigo
      from public.identidades i
     where i.documento_hash = v_hash
  loop
    v_hubo := true;
    perform public.registrar_acceso_identidad(v_fila.id, p_motivo, v_fila.es_prueba);
    v_res := v_res || jsonb_build_object(
      'id',                 v_fila.id,
      'titular_tipo',       v_fila.titular_tipo,
      'documento_ultimos4', v_fila.documento_ultimos4,
      'solicitud_codigo',   v_fila.solicitud_codigo
    );
  end loop;

  if not v_hubo then
    perform public.registrar_acceso_identidad(null, p_motivo, false);
  end if;

  return v_res;
end;
$$;

revoke execute on function public.buscar_identidad_presencial(text,text) from public, anon;
grant  execute on function public.buscar_identidad_presencial(text,text) to authenticated;

-- Comprobar:
--   select has_table_privilege('anon','public.identidades','SELECT');            -- f
--   select has_table_privilege('authenticated','public.identidades','SELECT');   -- f
--   select has_function_privilege('authenticated','public.descifrar_texto(bytea)','EXECUTE'); -- f
--   select has_function_privilege('authenticated','public.leer_identidad(uuid,text)','EXECUTE'); -- t
--
--   -- Ida y vuelta, y que lo guardado NO se parezca a lo que entró:
--   select public.descifrar_texto(public.cifrar_texto('Ana Restrepo'));          -- Ana Restrepo
--   select public.hash_documento('1.020.304-5') = public.hash_documento('10203045'); -- t
--   select public.normalizar_telefono('+57 300 123 4567');                       -- 3001234567
--
--   -- Y que la bitácora sobreviva a lo que registra: borrar la solicitud
--   -- de la que cuelga una identidad de prueba deja la fila de
--   -- accesos_identidad con identidad_id nulo y identidad_ref intacto.
