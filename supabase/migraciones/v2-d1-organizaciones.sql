-- =====================================================================
-- v2 · Fase D — Organizaciones aliadas y el rol que las acompaña
--
-- Implementa PLAN-V2 §5.5. Dos actos separados, y esa separación es la que
-- aguanta el peso:
--
--   1. La organización la crea un ADMINISTRADOR. Nunca se auto-registra.
--      Por eso no hay columna `verificada` ni cola de verificación: si la
--      fila existe, es porque alguien miró el RUES y el NIT antes.
--   2. Las personas se unen CONTRA esa organización trayendo su `slug`.
--      Con código de invitación quedan activas; sin código, pendientes.
--
-- El slug identifica, el código autoriza. No esconder el listado no es la
-- medida de seguridad —un slug se adivina al segundo intento—; la medida
-- es que quien llega sin código cae en una cola donde no ve nada.
--
-- Lo que esta migración NO hace, a propósito: no toca identidades, no
-- crea conversaciones y no mueve un solo dato personal de un solicitante.
-- Eso es de la Fase E en adelante, y va detrás del contrato de
-- transmisión de datos (§12.1).
--
-- Esto tampoco es `entidades` (Fase C). Aquella es un renglón de
-- directorio sin aval; esta es un actor operativo con personas dentro. Si
-- una entidad del directorio se vuelve aliada, tendrá las dos filas.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. `perfiles` gana el tipo 'aliado'
--
-- No basta con ampliar el CHECK (§5.3-2): `crear_perfil` rechazaba el tipo
-- en duro, y `contacto_publico` era `not null` de 7 a 40 caracteres, donde
-- un aliado no cabe. Un aliado no publica su teléfono en ninguna parte:
-- el contacto con él ocurre dentro de una coordinación, no en una ficha.
--
-- Los `drop constraint if exists` van antes para que el archivo se pueda
-- volver a correr. Postgres nombra los CHECK de columna
-- `<tabla>_<columna>_check`, así que estos son los nombres reales.
-- ---------------------------------------------------------------------

alter table public.perfiles drop constraint if exists perfiles_tipo_check;
alter table public.perfiles add  constraint perfiles_tipo_check
  check (tipo in ('ofertador','servidor','aliado'));

alter table public.perfiles alter column contacto_publico drop not null;

alter table public.perfiles drop constraint if exists perfiles_contacto_publico_check;
alter table public.perfiles add  constraint perfiles_contacto_publico_check
  check (
    case
      when tipo = 'aliado'
        then contacto_publico is null
          or char_length(contacto_publico) between 7 and 40
      else char_length(contacto_publico) between 7 and 40
    end
  );

comment on column public.perfiles.contacto_publico is
  'Dato personal deliberadamente público. Requiere acepto_publicacion = true. NULL solo para tipo = aliado: a un aliado no se le publica contacto en ninguna pantalla, el trato con él ocurre dentro de una coordinación.';

-- Las tres vistas públicas de personas ya excluyen a los aliados sin
-- tocarlas: `servidores_publicos` y `municipios_con_servidores` filtran
-- `tipo = 'servidor'`, y `ofertadores_publicos` exige
-- `acepto_publicacion = true`, que un perfil creado por `unirse_a_organizacion`
-- nunca tiene. Comprobarlo está en el bloque de verificación del final.

-- ---------------------------------------------------------------------
-- 2. Las tres tablas
-- ---------------------------------------------------------------------

create table if not exists public.organizaciones (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null check (char_length(trim(nombre)) between 3 and 80),
  tipo             text not null default 'fundacion'
                     check (tipo in ('fundacion','corporacion','entidad_publica','junta','otra')),
  -- Sin dígito de verificación obligatorio: el admin copia lo que dice el
  -- certificado del RUES, y ahí aparece de las dos formas.
  nit              text not null unique check (nit ~ '^[0-9]{5,15}(-[0-9])?$'),
  -- Identifica, no autoriza. Va en la URL de /unirse y en el QR.
  slug             text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  municipios       text[] not null default '{}'
                     check (array_length(municipios, 1) >= 1),
  -- Dirección de un acopio, no de una persona: es una bodega con horario
  -- de atención, y el propio aliado quiere que se sepa dónde queda.
  direccion_acopio text check (char_length(direccion_acopio) <= 200),
  horario_acopio   text check (char_length(horario_acopio) <= 200),
  -- Lo único que hace falta para suspender. No hay `verificada` porque la
  -- verificación ocurre FUERA, antes de que exista la fila.
  activa           boolean not null default true,
  -- SET NULL y no CASCADE, por lo mismo que `entidades.creada_por`:
  -- `limpiar-pruebas.sql` borra cuentas de `auth.users` por prefijo de
  -- uuid, y con CASCADE eso se llevaría organizaciones reales dadas de
  -- alta desde una cuenta de prueba con permisos de admin.
  creada_por       uuid references auth.users(id) on delete set null,
  creada_at        timestamptz not null default now(),
  actualizada_at   timestamptz not null default now(),
  -- Temporal. La deriva `guardar_organizacion` del prefijo del NOMBRE,
  -- que es un campo visible, nunca por parámetro.
  es_prueba        boolean not null default false
);

comment on table public.organizaciones is
  'Aliadas del Flujo 2. LAS CREA UN ADMIN, jamás se auto-registran. Si la fila existe, alguien ya miró el certificado del RUES y el NIT: por eso no hay columna verificada. Ver PLAN-V2 §5.5.';

create table if not exists public.invitaciones_organizacion (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones(id) on delete cascade,
  -- ⚠ En claro, y es deliberado — al revés que `solicitudes.token_hash`.
  -- Un token de solicitud se muestra una vez y quien lo pierde pierde la
  -- solicitud; un código de invitación tiene que poder volver a verse
  -- desde el panel del coordinador para reimprimir el QR de la pared.
  -- Lo que lo acota no es el secreto perfecto, sino que caduca, se agota
  -- y se puede desactivar de un clic.
  codigo          text not null unique check (codigo ~ '^[a-f0-9]{24}$'),
  rol_otorgado    text not null default 'miembro'
                    check (rol_otorgado in ('coordinador','miembro')),
  creada_por      uuid references public.perfiles(id) on delete set null,
  expira_at       timestamptz not null,
  usos_max        integer not null default 1 check (usos_max between 1 and 200),
  usos            integer not null default 0 check (usos >= 0),
  activa          boolean not null default true,
  creada_at       timestamptz not null default now()
);

comment on column public.invitaciones_organizacion.codigo is
  'En claro a propósito: el coordinador tiene que poder reimprimir el QR. Caduca, se agota por usos y se desactiva de un clic. Nunca aparece en un log ni en una query string de la aplicación (regla 6): viaja en el path de /unirse/[slug] o en el body.';

create index if not exists idx_invitaciones_org
  on public.invitaciones_organizacion(organizacion_id, activa);

create table if not exists public.miembros_organizacion (
  organizacion_id       uuid not null references public.organizaciones(id) on delete cascade,
  perfil_id             uuid not null references public.perfiles(id) on delete cascade,
  rol                   text not null default 'miembro'
                          check (rol in ('coordinador','miembro')),
  estado                text not null default 'pendiente'
                          check (estado in ('pendiente','activo','inactivo')),
  -- ⚠ NUNCA se pone en true al insertar. Lo impide un trigger, no solo la
  -- buena voluntad de las RPC: es el permiso que deja ver cédulas.
  puede_ver_identidad   boolean not null default false,
  puede_moderar         boolean not null default false,
  invitacion_id         uuid references public.invitaciones_organizacion(id) on delete set null,
  creado_at             timestamptz not null default now(),
  aprobado_por          uuid references public.perfiles(id) on delete set null,
  aprobado_at           timestamptz,
  -- El registro que pide §5.5-3: quién tocó `puede_ver_identidad` por
  -- última vez y cuándo. Sirve igual para conceder que para quitar.
  permiso_identidad_por uuid references public.perfiles(id) on delete set null,
  permiso_identidad_at  timestamptz,
  primary key (organizacion_id, perfil_id)
);

comment on column public.miembros_organizacion.puede_ver_identidad is
  'El permiso más sensible del sistema. Solo lo cambia otorgar_permiso_miembro, y queda registrado en permiso_identidad_por / _at. Un trigger BEFORE INSERT impide que nazca en true, incluso escribiendo desde el editor SQL.';

create index if not exists idx_miembros_perfil
  on public.miembros_organizacion(perfil_id);

-- ---------------------------------------------------------------------
-- 3. Pertenencia — UNA función, no la condición repetida en quince sitios
--
-- ⚠ Al revés que `es_admin()`, estas llevan el EXECUTE CONCEDIDO. La de
-- admin lo tiene revocado y por eso no sirve dentro de una política RLS
-- (§5.3-4). Estas sí tienen que servir ahí el día que una política las
-- necesite, y encapsular la pertenencia en una función `security definer`
-- es justamente lo que evita la recursión infinita entre
-- `miembros_organizacion` y `conversaciones` de la Fase G.
--
-- Y las tres condiciones van juntas de una vez: miembro activo, de una
-- organización activa. Un miembro pendiente o inactivo no pasa ningún
-- filtro de aliado (§5.5-5), y no queremos que eso dependa de que cada
-- RPC futura se acuerde de escribirlo.
-- ---------------------------------------------------------------------

create or replace function public.es_miembro_activo(
  p_organizacion_id uuid,
  p_perfil_id       uuid default auth.uid()
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.miembros_organizacion m
      join public.organizaciones o on o.id = m.organizacion_id
     where m.organizacion_id = p_organizacion_id
       and m.perfil_id       = p_perfil_id
       and m.estado          = 'activo'
       and o.activa
  );
$$;

create or replace function public.es_coordinador_activo(
  p_organizacion_id uuid,
  p_perfil_id       uuid default auth.uid()
)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.miembros_organizacion m
      join public.organizaciones o on o.id = m.organizacion_id
     where m.organizacion_id = p_organizacion_id
       and m.perfil_id       = p_perfil_id
       and m.estado          = 'activo'
       and m.rol             = 'coordinador'
       and o.activa
  );
$$;

grant execute on function public.es_miembro_activo(uuid,uuid)     to authenticated;
grant execute on function public.es_coordinador_activo(uuid,uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Los invariantes que van en la base, no en la interfaz
-- ---------------------------------------------------------------------

-- 4.1 · `puede_ver_identidad` nunca nace en true.
create or replace function public.bloquear_permiso_identidad()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.puede_ver_identidad then
    raise exception 'El permiso de ver identidad no se concede al crear el miembro: solo con otorgar_permiso_miembro';
  end if;
  return new;
end;
$$;

drop trigger if exists tr_permiso_identidad_al_insertar on public.miembros_organizacion;
create trigger tr_permiso_identidad_al_insertar
  before insert on public.miembros_organizacion
  for each row execute function public.bloquear_permiso_identidad();

-- 4.2 · Una organización con miembros no puede quedarse sin coordinador
-- activo. Va como trigger y no como comprobación dentro de la RPC porque
-- son cuatro caminos distintos —degradar, desactivar, borrar el miembro,
-- borrar el perfil— y el cuarto ni siquiera pasa por una RPC de aliado.
--
-- El `exists` sobre `organizaciones` es lo que deja borrar la organización
-- entera: en ese caso el CASCADE ya se llevó la fila madre y no hay nada
-- que proteger.
create or replace function public.exigir_coordinador()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.organizaciones o where o.id = old.organizacion_id)
     and exists (select 1 from public.miembros_organizacion m
                  where m.organizacion_id = old.organizacion_id)
     and not exists (select 1 from public.miembros_organizacion m
                      where m.organizacion_id = old.organizacion_id
                        and m.rol    = 'coordinador'
                        and m.estado = 'activo')
  then
    raise exception 'La organización se quedaría sin ningún coordinador activo';
  end if;
  return null;
end;
$$;

drop trigger if exists tr_exigir_coordinador on public.miembros_organizacion;
create constraint trigger tr_exigir_coordinador
  after update or delete on public.miembros_organizacion
  deferrable initially deferred
  for each row execute function public.exigir_coordinador();

-- ---------------------------------------------------------------------
-- 5. RLS — cero políticas, y es deliberado
--
-- Las tres tablas quedan revocadas enteras para `anon` y `authenticated`.
-- La frontera son las RPC de más abajo, como en `solicitudes` y en
-- `ofrecimientos`, no una política.
--
-- Es además la forma más corta de no caer en la recursión de §5.3-4: si
-- no hay política que cruce `miembros_organizacion` con nada, no hay
-- ciclo posible. Cuando la Fase G traiga `conversaciones`, la pertenencia
-- ya está encapsulada en `es_miembro_activo()`, con su EXECUTE concedido.
-- ---------------------------------------------------------------------

alter table public.organizaciones            enable row level security;
alter table public.invitaciones_organizacion enable row level security;
alter table public.miembros_organizacion     enable row level security;

revoke all on public.organizaciones            from anon, authenticated;
revoke all on public.invitaciones_organizacion from anon, authenticated;
revoke all on public.miembros_organizacion     from anon, authenticated;

revoke execute on function public.bloquear_permiso_identidad() from public, anon, authenticated;
revoke execute on function public.exigir_coordinador()         from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Alta y edición — solo administrador
-- ---------------------------------------------------------------------

create or replace function public.guardar_organizacion(
  p_id               uuid,                    -- null = crear
  p_nombre           text,
  p_nit              text,
  p_slug             text,
  p_municipios       text[],
  p_tipo             text default 'fundacion',
  p_direccion_acopio text default null,
  p_horario_acopio   text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_slug text := lower(trim(coalesce(p_slug, '')));
  v_nit  text := trim(coalesce(p_nit, ''));
  v_id   uuid;
begin
  if not public.es_admin(v_uid) then
    raise exception 'No autorizado';
  end if;

  if char_length(trim(coalesce(p_nombre, ''))) not between 3 and 80 then
    raise exception 'El nombre debe tener entre 3 y 80 caracteres';
  end if;

  if p_tipo not in ('fundacion','corporacion','entidad_publica','junta','otra') then
    raise exception 'Tipo de organización inválido';
  end if;

  if v_nit !~ '^[0-9]{5,15}(-[0-9])?$' then
    raise exception 'El NIT va en números, con o sin dígito de verificación: 900123456 o 900123456-7';
  end if;

  if v_slug !~ '^[a-z0-9-]{3,40}$' then
    raise exception 'La dirección corta va en minúsculas, números y guiones, de 3 a 40 caracteres';
  end if;

  if coalesce(array_length(p_municipios, 1), 0) = 0 then
    raise exception 'Elige al menos un municipio';
  end if;

  if exists (select 1 from unnest(p_municipios) m
              where m not in (select mu.codigo_dane from public.municipios mu)) then
    raise exception 'Hay un municipio que no existe';
  end if;

  -- Mensaje propio en vez del error crudo del índice único: el admin tiene
  -- que saber cuál de los dos chocó.
  if exists (select 1 from public.organizaciones o
              where o.slug = v_slug and (p_id is null or o.id <> p_id)) then
    raise exception 'Esa dirección corta ya la usa otra organización';
  end if;

  if exists (select 1 from public.organizaciones o
              where o.nit = v_nit and (p_id is null or o.id <> p_id)) then
    raise exception 'Ese NIT ya está registrado';
  end if;

  if p_id is null then
    insert into public.organizaciones
      (nombre, tipo, nit, slug, municipios,
       direccion_acopio, horario_acopio, creada_por, es_prueba)
    values
      (trim(p_nombre), p_tipo, v_nit, v_slug, p_municipios,
       nullif(trim(p_direccion_acopio), ''),
       nullif(trim(p_horario_acopio), ''),
       v_uid,
       trim(p_nombre) ilike 'prueba%')
    returning id into v_id;
  else
    update public.organizaciones
       set nombre           = trim(p_nombre),
           tipo             = p_tipo,
           nit              = v_nit,
           slug             = v_slug,
           municipios       = p_municipios,
           direccion_acopio = nullif(trim(p_direccion_acopio), ''),
           horario_acopio   = nullif(trim(p_horario_acopio), ''),
           -- Se RECALCULA, igual que en `guardar_entidad`: la marca tiene
           -- que seguir diciendo lo que se ve en pantalla.
           es_prueba        = trim(p_nombre) ilike 'prueba%',
           actualizada_at   = now()
     where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Esa organización no existe';
    end if;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.guardar_organizacion(uuid,text,text,text,text[],text,text,text) from public, anon;
grant  execute on function public.guardar_organizacion(uuid,text,text,text,text[],text,text,text) to authenticated;

-- Suspender. No borra: si una organización se desactiva con hilos vivos,
-- la Fase I se encarga del fallback de §8-F5. Aquí lo único que hace es
-- que `es_miembro_activo()` devuelva falso para todo su equipo.
create or replace function public.activar_organizacion(p_id uuid, p_activa boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;
  update public.organizaciones
     set activa = p_activa, actualizada_at = now()
   where id = p_id;
end;
$$;

revoke execute on function public.activar_organizacion(uuid,boolean) from public, anon;
grant  execute on function public.activar_organizacion(uuid,boolean) to authenticated;

-- Lo que ve el panel de administración. Va por RPC y no por `select` con
-- política, por lo mismo que `sugerencias_pendientes`: así `creada_por` —el
-- uuid de `auth.users` de una persona real— no sale nunca hacia el
-- navegador, y de paso el conteo del equipo viene resuelto.
create or replace function public.organizaciones_admin()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select case when not public.es_admin(auth.uid()) then '[]'::jsonb
         else coalesce(
           (select jsonb_agg(x order by x->>'nombre')
              from (
                select jsonb_build_object(
                  'id',               o.id,
                  'nombre',           o.nombre,
                  'tipo',             o.tipo,
                  'nit',              o.nit,
                  'slug',             o.slug,
                  'municipios',       o.municipios,
                  'direccion_acopio', o.direccion_acopio,
                  'horario_acopio',   o.horario_acopio,
                  'activa',           o.activa,
                  'coordinadores',    (select count(*) from public.miembros_organizacion m
                                        where m.organizacion_id = o.id
                                          and m.rol = 'coordinador' and m.estado = 'activo'),
                  'miembros',         (select count(*) from public.miembros_organizacion m
                                        where m.organizacion_id = o.id and m.estado = 'activo'),
                  'pendientes',       (select count(*) from public.miembros_organizacion m
                                        where m.organizacion_id = o.id and m.estado = 'pendiente'),
                  'invitaciones',     (select coalesce(jsonb_agg(jsonb_build_object(
                                                'id',           i.id,
                                                'codigo',       i.codigo,
                                                'rol_otorgado', i.rol_otorgado,
                                                'expira_at',    i.expira_at,
                                                'usos',         i.usos,
                                                'usos_max',     i.usos_max
                                              ) order by i.creada_at desc), '[]'::jsonb)
                                         from public.invitaciones_organizacion i
                                        where i.organizacion_id = o.id
                                          and i.activa and i.expira_at > now()
                                          and i.usos < i.usos_max)
                ) as x
                from public.organizaciones o
              ) t),
           '[]'::jsonb)
         end;
$$;

revoke execute on function public.organizaciones_admin() from public, anon;
grant  execute on function public.organizaciones_admin() to authenticated;

-- ---------------------------------------------------------------------
-- 7. Invitaciones — el administrador abre la puerta una vez, el
--    coordinador la abre de ahí en adelante
--
-- Un admin solo puede crear invitaciones de COORDINADOR, y solo eso: es
-- el acto de entregarle la organización a la fundación, no el de meterle
-- gente. A partir de ahí el equipo lo arma el coordinador, que es quien
-- sabe quién trabaja ahí.
-- ---------------------------------------------------------------------

create or replace function public.crear_invitacion(
  p_organizacion_id uuid,
  p_rol             text default 'miembro',
  p_horas           integer default 168,     -- una semana
  p_usos_max        integer default 1
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_admin  boolean := public.es_admin(v_uid);
  v_codigo text;
  v_fila   public.invitaciones_organizacion;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if p_rol not in ('coordinador','miembro') then
    raise exception 'Rol inválido';
  end if;

  if v_admin then
    if p_rol <> 'coordinador' then
      raise exception 'Un administrador solo genera la invitación de coordinador; el resto del equipo lo arma la organización';
    end if;
  elsif not public.es_coordinador_activo(p_organizacion_id, v_uid) then
    raise exception 'No autorizado';
  end if;

  if not exists (select 1 from public.organizaciones o
                  where o.id = p_organizacion_id and o.activa) then
    raise exception 'Esa organización no existe o está desactivada';
  end if;

  -- Techos duros, no sugerencias: un enlace de un año con usos ilimitados
  -- es una puerta abierta con la llave puesta.
  if p_horas not between 1 and 720 then
    raise exception 'La vigencia va entre 1 hora y 30 días';
  end if;

  if p_usos_max not between 1 and 200 then
    raise exception 'Los usos van entre 1 y 200';
  end if;

  if p_rol = 'coordinador' and p_usos_max <> 1 then
    raise exception 'Una invitación de coordinador es de un solo uso';
  end if;

  v_codigo := encode(extensions.gen_random_bytes(12), 'hex');

  insert into public.invitaciones_organizacion
    (organizacion_id, codigo, rol_otorgado, creada_por, expira_at, usos_max)
  values
    (p_organizacion_id, v_codigo, p_rol,
     case when v_admin then null else v_uid end,
     now() + make_interval(hours => p_horas), p_usos_max)
  returning * into v_fila;

  return jsonb_build_object(
    'id',           v_fila.id,
    'codigo',       v_fila.codigo,
    'rol_otorgado', v_fila.rol_otorgado,
    'expira_at',    v_fila.expira_at,
    'usos',         v_fila.usos,
    'usos_max',     v_fila.usos_max,
    'slug',         (select o.slug from public.organizaciones o where o.id = p_organizacion_id)
  );
end;
$$;

revoke execute on function public.crear_invitacion(uuid,text,integer,integer) from public, anon;
grant  execute on function public.crear_invitacion(uuid,text,integer,integer) to authenticated;

create or replace function public.desactivar_invitacion(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organizacion_id into v_org
    from public.invitaciones_organizacion where id = p_id;

  if v_org is null then
    raise exception 'Esa invitación no existe';
  end if;

  if not (public.es_admin(auth.uid()) or public.es_coordinador_activo(v_org)) then
    raise exception 'No autorizado';
  end if;

  update public.invitaciones_organizacion set activa = false where id = p_id;
end;
$$;

revoke execute on function public.desactivar_invitacion(uuid) from public, anon;
grant  execute on function public.desactivar_invitacion(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 8. Unirse
--
-- `organizacion_por_slug` devuelve UNA cosa: el nombre. Es lo mínimo para
-- que quien abre el enlace sepa a qué le está entrando antes de dar
-- «iniciar sesión con Google», y lo máximo que se puede decir sin saber
-- quién pregunta. Nada de municipios, nada de dirección de acopio, nada
-- de cuánta gente hay dentro.
-- ---------------------------------------------------------------------

create or replace function public.organizacion_por_slug(p_slug text)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select jsonb_build_object('nombre', o.nombre)
    from public.organizaciones o
   where o.slug = lower(trim(p_slug)) and o.activa;
$$;

grant execute on function public.organizacion_por_slug(text) to anon, authenticated;

-- El código autoriza; el slug solo identifica. Sin código válido se entra
-- a la cola de pendientes, NUNCA con un error: un código caducado suele
-- ser un cartel viejo en la pared de la fundación, no un ataque, y
-- mandarle un error a quien de verdad trabaja ahí lo deja fuera.
--
-- Crea el perfil si no existe, porque un miembro necesita fila en
-- `perfiles` para existir y no tiene sentido mandarlo a /registro a
-- declarar un contacto público que no se le va a publicar. Si YA tiene
-- perfil, no se le toca el tipo: un ofertador que además coordina en una
-- fundación sigue siendo ofertador en su ficha pública.
create or replace function public.unirse_a_organizacion(
  p_slug           text,
  p_nombre_visible text,
  p_codigo         text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := auth.uid();
  v_org    public.organizaciones;
  v_inv    public.invitaciones_organizacion;
  v_actual public.miembros_organizacion;
  -- Separada del registro a propósito: es la que dice si hay que gastarle
  -- un uso a la invitación, y hay un camino —ya era miembro— donde el
  -- código era bueno pero no se usa.
  v_inv_id uuid;
  v_estado text := 'pendiente';
  v_rol    text := 'miembro';
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;

  select * into v_org from public.organizaciones o
   where o.slug = lower(trim(p_slug)) and o.activa;

  if v_org.id is null then
    raise exception 'No encontramos esa organización';
  end if;

  if char_length(trim(coalesce(p_nombre_visible, ''))) not between 3 and 60 then
    raise exception 'Tu nombre debe tener entre 3 y 60 caracteres';
  end if;

  if public.contiene_pii(p_nombre_visible) then
    raise exception 'El nombre no puede llevar teléfonos, correos ni números de documento';
  end if;

  if coalesce(trim(p_codigo), '') <> '' then
    select * into v_inv from public.invitaciones_organizacion i
     where i.codigo = lower(trim(p_codigo))
       and i.organizacion_id = v_org.id
       and i.activa
       and i.expira_at > now()
       and i.usos < i.usos_max
     for update;

    if v_inv.id is not null then
      v_inv_id := v_inv.id;
      v_estado := 'activo';
      v_rol    := v_inv.rol_otorgado;
    end if;
  end if;

  -- Sin `contacto_publico` y sin `acepto_publicacion`: a un aliado no se
  -- le publica ficha, así que no hay nada que autorizar a publicar.
  insert into public.perfiles (id, nombre_visible, tipo, municipios, acepto_publicacion)
  values (v_uid, trim(p_nombre_visible), 'aliado', v_org.municipios, false)
  on conflict (id) do nothing;

  select * into v_actual from public.miembros_organizacion m
   where m.organizacion_id = v_org.id and m.perfil_id = v_uid;

  if v_actual.perfil_id is null then
    insert into public.miembros_organizacion
      (organizacion_id, perfil_id, rol, estado, invitacion_id,
       aprobado_por, aprobado_at)
    values
      (v_org.id, v_uid, v_rol, v_estado, v_inv_id,
       case when v_estado = 'activo' then v_uid end,
       case when v_estado = 'activo' then now() end);

  elsif v_actual.estado = 'pendiente' and v_estado = 'activo' then
    -- Estaba en la cola y volvió con un código bueno: se le abre sin que
    -- un coordinador tenga que aprobarlo.
    update public.miembros_organizacion
       set rol           = v_rol,
           estado        = 'activo',
           invitacion_id = v_inv_id,
           aprobado_por  = v_uid,
           aprobado_at   = now()
     where organizacion_id = v_org.id and perfil_id = v_uid;

  else
    -- Ya era miembro activo o lo desactivaron. Un código no revive a
    -- quien un coordinador sacó: eso lo decide el coordinador. Y no se
    -- gasta un uso de la invitación por volver a abrir el enlace.
    v_estado := v_actual.estado;
    v_rol    := v_actual.rol;
    v_inv_id := null;
  end if;

  if v_inv_id is not null then
    update public.invitaciones_organizacion
       set usos = usos + 1
     where id = v_inv_id;
  end if;

  return jsonb_build_object(
    'organizacion', v_org.nombre,
    'slug',         v_org.slug,
    'estado',       v_estado,
    'rol',          v_rol
  );
end;
$$;

revoke execute on function public.unirse_a_organizacion(text,text,text) from public, anon;
grant  execute on function public.unirse_a_organizacion(text,text,text) to authenticated;

-- ---------------------------------------------------------------------
-- 9. El panel del aliado
--
-- Una sola RPC para toda la pantalla, como `sugerencias_pendientes`. El
-- equipo y las invitaciones solo salen para un coordinador: un miembro
-- raso no tiene por qué ver la lista de quién más está dentro, y uno
-- pendiente no ve absolutamente nada de la organización (§5.5-5).
-- ---------------------------------------------------------------------

create or replace function public.mi_aliado()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(
    (select jsonb_agg(x order by x->'organizacion'->>'nombre')
       from (
         select jsonb_build_object(
           'organizacion', jsonb_build_object(
             'id',               o.id,
             'nombre',           o.nombre,
             'slug',             o.slug,
             'municipios',       o.municipios,
             'direccion_acopio', o.direccion_acopio,
             'horario_acopio',   o.horario_acopio,
             'activa',           o.activa
           ),
           'yo', jsonb_build_object(
             'rol',                 m.rol,
             'estado',              m.estado,
             'puede_ver_identidad', m.puede_ver_identidad,
             'puede_moderar',       m.puede_moderar
           ),
           'equipo', case
             when m.rol = 'coordinador' and m.estado = 'activo' then (
               select coalesce(jsonb_agg(jsonb_build_object(
                        'perfil_id',           mm.perfil_id,
                        'nombre_visible',      p.nombre_visible,
                        'rol',                 mm.rol,
                        'estado',              mm.estado,
                        'puede_ver_identidad', mm.puede_ver_identidad,
                        'puede_moderar',       mm.puede_moderar,
                        'creado_at',           mm.creado_at
                      ) order by mm.estado, p.nombre_visible), '[]'::jsonb)
                 from public.miembros_organizacion mm
                 join public.perfiles p on p.id = mm.perfil_id
                where mm.organizacion_id = o.id)
             else '[]'::jsonb end,
           'invitaciones', case
             when m.rol = 'coordinador' and m.estado = 'activo' then (
               select coalesce(jsonb_agg(jsonb_build_object(
                        'id',           i.id,
                        'codigo',       i.codigo,
                        'rol_otorgado', i.rol_otorgado,
                        'expira_at',    i.expira_at,
                        'usos',         i.usos,
                        'usos_max',     i.usos_max
                      ) order by i.creada_at desc), '[]'::jsonb)
                 from public.invitaciones_organizacion i
                where i.organizacion_id = o.id
                  and i.activa and i.expira_at > now() and i.usos < i.usos_max)
             else '[]'::jsonb end
         ) as x
           from public.miembros_organizacion m
           join public.organizaciones o on o.id = m.organizacion_id
          where m.perfil_id = auth.uid()
       ) t),
    '[]'::jsonb);
$$;

revoke execute on function public.mi_aliado() from public, anon;
grant  execute on function public.mi_aliado() to authenticated;

-- ---------------------------------------------------------------------
-- 10. Lo que hace un coordinador con su equipo
--
-- Una sola RPC con una acción, como `resolver_sugerencia`. Lo que NO
-- entra aquí es `puede_ver_identidad`: ese tiene función propia, más
-- abajo, y es a propósito. Un permiso que deja ver cédulas no puede
-- viajar como un valor más dentro de un menú de seis opciones.
--
-- Nadie se aplica una acción a sí mismo. No es cortesía: es lo que evita
-- que el único coordinador se degrade solo y deje la organización muda.
-- ---------------------------------------------------------------------

create or replace function public.gestionar_miembro(
  p_organizacion_id uuid,
  p_perfil_id       uuid,
  p_accion          text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not public.es_coordinador_activo(p_organizacion_id, v_uid) then
    raise exception 'No autorizado';
  end if;

  if p_perfil_id = v_uid then
    raise exception 'No puedes aplicarte esto a ti mismo. Pídeselo a otro coordinador';
  end if;

  if not exists (select 1 from public.miembros_organizacion m
                  where m.organizacion_id = p_organizacion_id
                    and m.perfil_id = p_perfil_id) then
    raise exception 'Esa persona no está en la organización';
  end if;

  if p_accion = 'aprobar' then
    update public.miembros_organizacion
       set estado = 'activo', aprobado_por = v_uid, aprobado_at = now()
     where organizacion_id = p_organizacion_id and perfil_id = p_perfil_id
       and estado = 'pendiente';

  elsif p_accion in ('rechazar','sacar') then
    -- Borrado duro, regla 4 de CLAUDE.md. Quien fue rechazado puede
    -- volver a intentarlo con un código bueno; no queda un renglón de
    -- «esta persona pidió entrar y le dijeron que no» rodando por ahí.
    delete from public.miembros_organizacion
     where organizacion_id = p_organizacion_id and perfil_id = p_perfil_id;

  elsif p_accion = 'desactivar' then
    update public.miembros_organizacion
       set estado = 'inactivo', puede_ver_identidad = false,
           permiso_identidad_por = case when puede_ver_identidad then v_uid
                                        else permiso_identidad_por end,
           permiso_identidad_at  = case when puede_ver_identidad then now()
                                        else permiso_identidad_at end
     where organizacion_id = p_organizacion_id and perfil_id = p_perfil_id;

  elsif p_accion = 'activar' then
    update public.miembros_organizacion
       set estado = 'activo', aprobado_por = v_uid, aprobado_at = now()
     where organizacion_id = p_organizacion_id and perfil_id = p_perfil_id;

  elsif p_accion = 'ascender' then
    update public.miembros_organizacion
       set rol = 'coordinador'
     where organizacion_id = p_organizacion_id and perfil_id = p_perfil_id
       and estado = 'activo';

  elsif p_accion = 'degradar' then
    update public.miembros_organizacion
       set rol = 'miembro'
     where organizacion_id = p_organizacion_id and perfil_id = p_perfil_id;

  else
    raise exception 'Acción inválida';
  end if;
end;
$$;

revoke execute on function public.gestionar_miembro(uuid,uuid,text) from public, anon;
grant  execute on function public.gestionar_miembro(uuid,uuid,text) to authenticated;

-- Los dos permisos, y solo por aquí. `puede_ver_identidad` es el que
-- justifica que esto sea una función aparte: es lo que deja ver cédulas,
-- y §5.5-3 dice que nunca se otorga solo —ni al entrar por enlace, ni al
-- ser aprobado, ni al ser coordinador—, siempre como acto explícito de
-- alguien sobre alguien, y registrado.
create or replace function public.otorgar_permiso_miembro(
  p_organizacion_id uuid,
  p_perfil_id       uuid,
  p_permiso         text,
  p_valor           boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not public.es_coordinador_activo(p_organizacion_id, v_uid) then
    raise exception 'No autorizado';
  end if;

  if p_permiso not in ('puede_ver_identidad','puede_moderar') then
    raise exception 'Permiso inválido';
  end if;

  -- Solo a gente activa: dar el permiso de ver cédulas a alguien que
  -- todavía está en la cola de aprobación no tiene ninguna lectura buena.
  if not exists (select 1 from public.miembros_organizacion m
                  where m.organizacion_id = p_organizacion_id
                    and m.perfil_id = p_perfil_id
                    and m.estado = 'activo') then
    raise exception 'Esa persona no es un miembro activo de la organización';
  end if;

  if p_permiso = 'puede_ver_identidad' then
    update public.miembros_organizacion
       set puede_ver_identidad   = p_valor,
           permiso_identidad_por = v_uid,
           permiso_identidad_at  = now()
     where organizacion_id = p_organizacion_id and perfil_id = p_perfil_id;
  else
    update public.miembros_organizacion
       set puede_moderar = p_valor
     where organizacion_id = p_organizacion_id and perfil_id = p_perfil_id;
  end if;
end;
$$;

revoke execute on function public.otorgar_permiso_miembro(uuid,uuid,text,boolean) from public, anon;
grant  execute on function public.otorgar_permiso_miembro(uuid,uuid,text,boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 11. `crear_perfil` acepta 'aliado'
--
-- Misma firma de diez parámetros, así que `create or replace` la
-- reemplaza de verdad y no crea una sobrecarga (la trampa de §5.3-7 es de
-- `crear_solicitud`, que sí cambia de firma).
--
-- Nadie se declara aliado desde /registro: el tipo aparece al unirse a una
-- organización. Lo que esto arregla es lo contrario — que un aliado pueda
-- editar su nombre o sus municipios sin que la RPC lo rechace o le cambie
-- el tipo por debajo.
-- ---------------------------------------------------------------------

create or replace function public.crear_perfil(
  p_nombre_visible    text,
  p_tipo              text,
  p_municipios        text[],
  p_contacto_publico  text,
  p_contacto_tipo     text,
  p_descripcion       text,
  p_profesion         text default null,
  p_entidad_matricula text default null,
  p_numero_matricula  text default null,
  p_servicios         text[] default '{}'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if p_tipo not in ('ofertador','servidor','aliado') then
    raise exception 'Tipo de perfil inválido';
  end if;

  if array_length(p_municipios, 1) is null then
    raise exception 'Elige al menos un municipio';
  end if;

  -- Un aliado no publica contacto ni ficha: lo que llegue en esos dos
  -- campos se descarta aquí, no se guarda «por si acaso».
  insert into public.perfiles (
    id, nombre_visible, tipo, municipios, contacto_publico,
    contacto_tipo, descripcion, acepto_publicacion, acepto_politica_at)
  values (
    v_uid, p_nombre_visible, p_tipo, p_municipios,
    case when p_tipo = 'aliado' then null else p_contacto_publico end,
    case when p_tipo = 'aliado' then 'whatsapp' else p_contacto_tipo end,
    nullif(trim(p_descripcion), ''),
    p_tipo <> 'aliado', now())
  on conflict (id) do update set
    nombre_visible     = excluded.nombre_visible,
    tipo               = excluded.tipo,
    municipios         = excluded.municipios,
    contacto_publico   = excluded.contacto_publico,
    contacto_tipo      = excluded.contacto_tipo,
    descripcion        = excluded.descripcion,
    acepto_publicacion = excluded.acepto_publicacion,
    acepto_politica_at = now();

  if p_tipo = 'servidor' then
    if coalesce(trim(p_profesion), '') = ''
       or coalesce(trim(p_numero_matricula), '') = ''
       or p_entidad_matricula is null then
      raise exception 'Indica profesión, entidad y número de matrícula';
    end if;

    if exists (select 1 from public.servidores sv
                where sv.entidad_matricula = p_entidad_matricula
                  and sv.numero_matricula = trim(p_numero_matricula)
                  and sv.perfil_id <> v_uid) then
      raise exception 'Esa matrícula ya está registrada por otra persona';
    end if;

    if exists (select 1 from unnest(p_servicios) s
                where s not in (select c.id from public.catalogo_servicios c where c.activo)) then
      raise exception 'Servicio no válido';
    end if;

    insert into public.servidores (perfil_id, profesion, entidad_matricula, numero_matricula, servicios)
    values (v_uid, trim(p_profesion), p_entidad_matricula, trim(p_numero_matricula), p_servicios)
    on conflict (perfil_id) do update set
      profesion         = excluded.profesion,
      entidad_matricula = excluded.entidad_matricula,
      numero_matricula  = excluded.numero_matricula,
      servicios         = excluded.servicios;
  else
    delete from public.servidores where perfil_id = v_uid;
  end if;
end;
$$;

revoke execute on function public.crear_perfil(text,text,text[],text,text,text,text,text,text,text[]) from public, anon;
grant  execute on function public.crear_perfil(text,text,text[],text,text,text,text,text,text,text[]) to authenticated;

-- Comprobar:
--   select has_table_privilege('anon','public.organizaciones','SELECT');           -- f
--   select has_table_privilege('authenticated','public.miembros_organizacion','SELECT'); -- f
--   select has_function_privilege('anon','public.organizacion_por_slug(text)','EXECUTE'); -- t
--   select has_function_privilege('anon','public.mi_aliado()','EXECUTE');          -- f
--
--   -- Un aliado no se cuela en ninguna lista pública:
--   select count(*) from public.ofertadores_publicos op
--     join public.perfiles p on p.id = op.id where p.tipo = 'aliado';             -- 0
--   select count(*) from public.servidores_publicos sp
--     join public.perfiles p on p.id = sp.id where p.tipo = 'aliado';             -- 0
--
--   -- Los tres invariantes, contra una organización de PRUEBA:
--   --  · insert directo con puede_ver_identidad = true          → excepción
--   --  · degradar al único coordinador                          → excepción
--   --  · es_miembro_activo() de alguien pendiente               → f
