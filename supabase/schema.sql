-- =====================================================================
-- Esquema completo. Ejecutar en el SQL Editor de Supabase.
--
-- Principio rector: la tabla `solicitudes` no contiene ningún dato
-- personal. El cliente NUNCA lee la tabla directamente: lee una vista
-- que excluye el token. Toda escritura pasa por funciones RPC.
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------
-- 1. Catálogos
-- ---------------------------------------------------------------------

create table if not exists public.catalogo_items (
  id            text primary key,
  categoria     text not null check (categoria in
                  ('alimentacion','aseo','salud','abrigo','cocina','otros','servicios','mascotas')),
  nombre        text not null,
  unidad        text not null default 'unidad',
  activo        boolean not null default true,
  orden         integer not null default 0
);

create table if not exists public.municipios (
  codigo_dane   text primary key,
  nombre        text not null,
  departamento  text not null,
  afectado      boolean not null default true
);

-- Servicios que puede ofrecer un profesional con matrícula.
create table if not exists public.catalogo_servicios (
  id        text primary key,
  area      text not null check (area in
              ('ingenieria','arquitectura','psicologia','salud','derecho')),
  nombre    text not null,
  activo    boolean not null default true,
  orden     integer not null default 0
);

comment on table public.catalogo_servicios is
  'PROHIBIDO agregar rescate, búsqueda de personas, urgencias o atención prehospitalaria: es competencia de bomberos, Defensa Civil y la línea 123, y ofrecerlo aquí contradice los términos de uso. Ver CLAUDE.md regla 5.';

-- ---------------------------------------------------------------------
-- 2. Perfiles (ofertadores y servidores) — aquí SÍ hay datos personales
-- ---------------------------------------------------------------------

create table if not exists public.perfiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  nombre_visible      text not null check (char_length(nombre_visible) between 3 and 60),
  tipo                text not null check (tipo in ('ofertador','servidor')),
  municipios          text[] not null default '{}',
  -- Contacto PÚBLICO: la persona acepta explícitamente que se muestre.
  contacto_publico    text not null check (char_length(contacto_publico) between 7 and 40),
  contacto_tipo       text not null default 'whatsapp'
                        check (contacto_tipo in ('whatsapp','telefono')),
  descripcion         text check (char_length(descripcion) <= 300),
  acepto_publicacion  boolean not null default false,
  acepto_politica_at  timestamptz not null default now(),
  suspendido          boolean not null default false,
  creado_at           timestamptz not null default now()
);

comment on column public.perfiles.contacto_publico is
  'Dato personal deliberadamente público. Requiere acepto_publicacion = true.';

create table if not exists public.servidores (
  perfil_id           uuid primary key references public.perfiles(id) on delete cascade,
  profesion           text not null,
  entidad_matricula   text not null check (entidad_matricula in
                        ('COPNIA','CPNAA','COLPSIC','ReTHUS','SIRNA','OTRA')),
  numero_matricula    text not null,
  verificado          boolean not null default false,
  verificado_at       timestamptz,
  -- SET NULL y no la cascada por defecto: si el administrador borra su
  -- propia cuenta, un NO ACTION aquí haría fallar el borrado y le negaría
  -- su derecho de supresión. La verificación sobrevive sin su autor.
  verificado_por      uuid references auth.users(id) on delete set null,
  -- ids de catalogo_servicios; la RPC crear_perfil valida que existan
  servicios           text[] not null default '{}',
  unique (entidad_matricula, numero_matricula)
);

create table if not exists public.administradores (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  creado_at   timestamptz not null default now()
);

create or replace function public.es_admin(uid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (select 1 from public.administradores a where a.user_id = uid);
$$;

revoke execute on function public.es_admin(uuid) from public, anon, authenticated;

-- OJO: por ese revoke, `es_admin()` NO se puede usar dentro de una política
-- RLS. La expresión de la política corre con los permisos de quien consulta,
-- así que cualquier lectura fallaba con "permission denied for function
-- es_admin" — para todo el mundo, no solo para administradores. Las
-- políticas de más abajo hacen el EXISTS contra `administradores` a mano.
-- Dentro de una RPC `security definer` sí es válido llamarla: ahí corre
-- como dueña de la función.

-- ---------------------------------------------------------------------
-- 3. Solicitudes — CERO datos personales
-- ---------------------------------------------------------------------

create table if not exists public.solicitudes (
  id              uuid primary key default gen_random_uuid(),
  codigo          text not null unique,          -- corto y legible, ej. '4F2A'
  token_hash      text not null,                 -- sha256 del token portador
  municipio       text not null references public.municipios(codigo_dane),
  barrio          text not null check (char_length(barrio) between 2 and 60),
  categoria       text not null check (categoria in
                    ('alimentacion','aseo','salud','abrigo','cocina','otros','servicios','mascotas')),
  nota            text check (char_length(nota) <= 140),
  estado          text not null default 'abierta'
                    check (estado in ('abierta','cumplida')),
  creada_at       timestamptz not null default now(),
  confirmada_at   timestamptz not null default now(),
  expira_at       timestamptz not null default now() + interval '72 hours'
);

comment on table public.solicitudes is
  'PROHIBIDO agregar columnas con datos personales. Ver CLAUDE.md regla 1.';

create index if not exists idx_solicitudes_municipio on public.solicitudes(municipio);
create index if not exists idx_solicitudes_categoria on public.solicitudes(categoria);
create index if not exists idx_solicitudes_expira    on public.solicitudes(expira_at);
create index if not exists idx_solicitudes_token     on public.solicitudes(token_hash);

create table if not exists public.solicitud_items (
  id              uuid primary key default gen_random_uuid(),
  solicitud_id    uuid not null references public.solicitudes(id) on delete cascade,
  item_id         text not null references public.catalogo_items(id),
  cantidad        numeric(8,2) not null check (cantidad > 0 and cantidad <= 9999),
  cubierto        boolean not null default false
);

create index if not exists idx_items_solicitud on public.solicitud_items(solicitud_id);

-- ---------------------------------------------------------------------
-- 4. Respuestas
-- ---------------------------------------------------------------------

create table if not exists public.respuestas (
  id              uuid primary key default gen_random_uuid(),
  solicitud_id    uuid not null references public.solicitudes(id) on delete cascade,
  autor_id        uuid not null references public.perfiles(id) on delete cascade,
  mensaje         text not null check (char_length(mensaje) between 5 and 200),
  creada_at       timestamptz not null default now(),
  unique (solicitud_id, autor_id)
);

-- ---------------------------------------------------------------------
-- 5. Suscripciones push — mueren con la solicitud
-- ---------------------------------------------------------------------

-- Avisos para quien OFRECE: la suscripción cuelga del perfil, no de una
-- solicitud, y muere con el perfil. Se le avisa solo de solicitudes en
-- sus propios municipios.
create table if not exists public.push_ofertadores (
  id         uuid primary key default gen_random_uuid(),
  perfil_id  uuid not null references public.perfiles(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth_key   text not null,
  creada_at  timestamptz not null default now(),
  unique (perfil_id, endpoint)
);

create table if not exists public.push_suscripciones (
  id              uuid primary key default gen_random_uuid(),
  solicitud_id    uuid not null references public.solicitudes(id) on delete cascade,
  endpoint        text not null,
  p256dh          text not null,
  auth_key        text not null,
  creada_at       timestamptz not null default now(),
  unique (solicitud_id, endpoint)
);

-- ---------------------------------------------------------------------
-- 6. Reportes y métricas
-- ---------------------------------------------------------------------

create table if not exists public.reportes (
  id              uuid primary key default gen_random_uuid(),
  tipo_objeto     text not null check (tipo_objeto in ('solicitud','respuesta','perfil')),
  objeto_id       uuid not null,
  motivo          text not null check (motivo in
                    ('datos_personales','estafa','contenido_ofensivo',
                     'informacion_falsa','menor_de_edad','otro')),
  nota            text check (char_length(nota) <= 300),
  atendido        boolean not null default false,
  creado_at       timestamptz not null default now()
);

-- Residuo anónimo. Sobrevive al borrado de la solicitud.
create table if not exists public.metricas (
  id                      bigserial primary key,
  municipio               text not null,
  categoria               text not null,
  cumplida                boolean not null,
  horas_hasta_respuesta   numeric(6,2),
  horas_hasta_cierre      numeric(6,2),
  num_respuestas          integer not null default 0,
  registrada_at           timestamptz not null default now()
);

comment on table public.metricas is
  'Sin texto, sin ubicación fina, sin identificadores. Publicable como dato abierto.';

-- ---------------------------------------------------------------------
-- 7. Vistas públicas — lo único que el cliente puede leer
-- ---------------------------------------------------------------------

create or replace view public.solicitudes_publicas as
select
  s.id,
  s.codigo,
  s.municipio,
  m.nombre as municipio_nombre,
  s.barrio,
  s.categoria,
  s.nota,
  s.creada_at,
  s.confirmada_at,
  s.expira_at,
  extract(epoch from (now() - s.confirmada_at)) / 3600 as horas_sin_confirmar,
  (select count(*) from public.respuestas r where r.solicitud_id = s.id) as num_respuestas,
  (select coalesce(jsonb_agg(jsonb_build_object(
             'nombre', c.nombre, 'cantidad', si.cantidad, 'unidad', c.unidad
           ) order by c.orden), '[]'::jsonb)
     from public.solicitud_items si
     join public.catalogo_items c on c.id = si.item_id
    where si.solicitud_id = s.id) as items
from public.solicitudes s
join public.municipios m on m.codigo_dane = s.municipio
where s.estado = 'abierta'
  and s.expira_at > now();

create or replace view public.servidores_publicos as
select
  p.id,
  p.nombre_visible,
  p.municipios,
  p.contacto_publico,
  p.contacto_tipo,
  p.descripcion,
  sv.profesion,
  sv.entidad_matricula,
  sv.numero_matricula,
  sv.verificado,
  sv.servicios
from public.perfiles p
join public.servidores sv on sv.perfil_id = p.id
where p.tipo = 'servidor'
  and p.suspendido = false
  and p.acepto_publicacion = true;

-- Solo los municipios que de verdad tienen contenido. Existen por peso:
-- mandar los 1.122 municipios del país en cada carga del tablero pesaba
-- más que todo el resto de la página, y el público entra con señal mala.
create or replace view public.municipios_con_solicitudes as
select distinct m.codigo_dane, m.nombre, m.departamento
from public.municipios m
join public.solicitudes s on s.municipio = m.codigo_dane
where s.estado = 'abierta' and s.expira_at > now();

-- Directorio de quienes ofrecen insumos. A diferencia de
-- `servidores_publicos`, NO expone `contacto_publico`: el contacto ocurre
-- cuando el ofertador responde una solicitud, no al revés. Así se expone
-- menos dato y nadie queda sujeto a que lo llamen 200 personas a la vez.
create or replace view public.ofertadores_publicos as
select p.id, p.nombre_visible, p.municipios, p.descripcion, p.creado_at
from public.perfiles p
where p.tipo = 'ofertador'
  and p.suspendido = false
  and p.acepto_publicacion = true;

create or replace view public.municipios_con_ofertadores as
select distinct m.codigo_dane, m.nombre, m.departamento
from public.municipios m
join public.perfiles p on m.codigo_dane = any(p.municipios)
where p.tipo = 'ofertador'
  and p.suspendido = false
  and p.acepto_publicacion = true;

grant select on public.ofertadores_publicos       to anon, authenticated;
grant select on public.municipios_con_ofertadores to anon, authenticated;

create or replace view public.municipios_con_servidores as
select distinct m.codigo_dane, m.nombre, m.departamento
from public.municipios m
join public.perfiles p on m.codigo_dane = any(p.municipios)
where p.tipo = 'servidor'
  and p.suspendido = false
  and p.acepto_publicacion = true;

grant select on public.municipios_con_solicitudes to anon, authenticated;
grant select on public.municipios_con_servidores  to anon, authenticated;

-- Los 1.122 municipios del país en una sola fila jsonb.
--
-- PostgREST corta cualquier respuesta en 1000 filas y Supabase impone ese
-- tope del lado del servidor: ni `limit` ni la cabecera `Range` lo suben.
-- Con un `select` normal desaparecían los 122 del final del alfabeto
-- —Yumbo, Zarzal, Zona Bananera— y quien vive ahí no podía ni publicar una
-- solicitud ni registrarse. Una fila nunca se corta.
create or replace function public.listar_municipios()
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'codigo_dane',  m.codigo_dane,
        'nombre',       m.nombre,
        'departamento', m.departamento
      ) order by m.nombre
    ),
    '[]'::jsonb
  )
  from public.municipios m;
$$;

grant execute on function public.listar_municipios() to anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. RLS
-- ---------------------------------------------------------------------

alter table public.solicitudes        enable row level security;
alter table public.solicitud_items    enable row level security;
alter table public.respuestas         enable row level security;
alter table public.perfiles           enable row level security;
alter table public.servidores         enable row level security;
alter table public.push_suscripciones enable row level security;
alter table public.push_ofertadores    enable row level security;
alter table public.reportes           enable row level security;
alter table public.metricas           enable row level security;
alter table public.administradores    enable row level security;

-- Nadie lee `solicitudes` directamente. Solo la vista y las RPC.
revoke all on public.solicitudes        from anon, authenticated;
revoke all on public.push_suscripciones from anon, authenticated;
revoke all on public.push_ofertadores    from anon, authenticated;
grant select on public.solicitudes_publicas to anon, authenticated;
grant select on public.servidores_publicos  to anon, authenticated;

-- Catálogos: lectura pública
alter table public.catalogo_items     enable row level security;
alter table public.municipios         enable row level security;
alter table public.catalogo_servicios enable row level security;
create policy "catalogo lectura publica" on public.catalogo_items
  for select to public using (activo = true);
create policy "municipios lectura publica" on public.municipios
  for select to public using (true);
create policy "servicios lectura publica" on public.catalogo_servicios
  for select to public using (activo = true);

-- Ítems: legibles porque no contienen nada personal
create policy "items lectura publica" on public.solicitud_items
  for select to public using (true);

-- Perfiles: solo el dueño lee la fila cruda; el público usa la vista
create policy "perfil propio lectura" on public.perfiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "perfil propio insert" on public.perfiles
  for insert to authenticated with check ((select auth.uid()) = id);
create policy "perfil propio update" on public.perfiles
  for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
create policy "perfil propio delete" on public.perfiles
  for delete to authenticated using ((select auth.uid()) = id);

create policy "servidor propio lectura" on public.servidores
  for select to authenticated using ((select auth.uid()) = perfil_id);
create policy "servidor propio insert" on public.servidores
  for insert to authenticated with check ((select auth.uid()) = perfil_id);
create policy "servidor propio update" on public.servidores
  for update to authenticated
  using ((select auth.uid()) = perfil_id) with check ((select auth.uid()) = perfil_id);

-- Respuestas: el autor ve las suyas. El solicitante las ve vía RPC con token.
create policy "respuestas propias" on public.respuestas
  for select to authenticated using ((select auth.uid()) = autor_id);
create policy "respuestas insert" on public.respuestas
  for insert to authenticated with check ((select auth.uid()) = autor_id);
create policy "respuestas delete propia" on public.respuestas
  for delete to authenticated using ((select auth.uid()) = autor_id);

-- Reportes: cualquiera reporta, solo admin lee
create policy "reportar es publico" on public.reportes
  for insert to public with check (true);
create policy "admin lee reportes" on public.reportes
  for select to authenticated using (exists (select 1 from public.administradores a where a.user_id = (select auth.uid())));
create policy "admin actualiza reportes" on public.reportes
  for update to authenticated using (exists (select 1 from public.administradores a where a.user_id = (select auth.uid())));

-- Métricas: lectura pública, escritura solo por el job
create policy "metricas lectura publica" on public.metricas
  for select to public using (true);

-- Sin esta política, `administradores` queda con RLS activo y cero reglas:
-- la consulta devuelve vacío incluso para un administrador real y /admin
-- se vuelve inaccesible. Cada quien solo puede ver su propia fila.
create policy "admin se ve a si mismo" on public.administradores
  for select to authenticated using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------
-- 9. RPC — toda escritura de solicitudes pasa por aquí
-- ---------------------------------------------------------------------

-- Genera un código corto legible y único
create or replace function public.generar_codigo()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  alfabeto text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';  -- sin 0,O,1,I
  intento  text;
  i        integer;
begin
  loop
    intento := '';
    for i in 1..4 loop
      intento := intento || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.solicitudes s where s.codigo = intento);
  end loop;
  return intento;
end;
$$;

-- Crea la solicitud. Devuelve el token EN CLARO una sola vez.
-- El backend (route handler) debe validar Turnstile antes de llamar esto.
create or replace function public.crear_solicitud(
  p_municipio   text,
  p_barrio      text,
  p_categoria   text,
  p_nota        text,
  p_items       jsonb,        -- [{"item_id":"pañales_2","cantidad":1}]
  p_token       text          -- generado en el servidor, 32 bytes base64url
)
returns table (solicitud_id uuid, codigo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid;
  v_codigo text;
  v_item   jsonb;
begin
  if p_nota is not null and p_nota ~ '(\+?57)?[ -]?3[0-9]{9}|[0-9]{7,}|@[a-zA-Z0-9._-]+\.[a-z]{2,}' then
    raise exception 'La nota no puede contener teléfonos ni correos';
  end if;

  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 12 then
    raise exception 'Debe incluir entre 1 y 12 ítems';
  end if;

  v_codigo := public.generar_codigo();

  insert into public.solicitudes (codigo, token_hash, municipio, barrio, categoria, nota)
  values (v_codigo, encode(extensions.digest(p_token, 'sha256'), 'hex'),
          p_municipio, p_barrio, p_categoria, nullif(trim(p_nota), ''))
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.solicitud_items (solicitud_id, item_id, cantidad)
    values (v_id, v_item->>'item_id', (v_item->>'cantidad')::numeric);
  end loop;

  return query select v_id, v_codigo;
end;
$$;

grant execute on function public.crear_solicitud(text,text,text,text,jsonb,text) to anon, authenticated;

-- Lee una solicitud con su token: incluye las respuestas
create or replace function public.leer_solicitud(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sol  public.solicitudes;
  v_resp jsonb;
  v_items jsonb;
begin
  select * into v_sol from public.solicitudes
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  if not found then
    raise exception 'Solicitud no encontrada o vencida';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'mensaje', r.mensaje, 'creada_at', r.creada_at,
           'nombre', p.nombre_visible, 'contacto', p.contacto_publico,
           'contacto_tipo', p.contacto_tipo, 'tipo', p.tipo,
           'profesion', sv.profesion, 'verificado', coalesce(sv.verificado, false)
         ) order by r.creada_at desc), '[]'::jsonb)
    into v_resp
    from public.respuestas r
    join public.perfiles p on p.id = r.autor_id
    left join public.servidores sv on sv.perfil_id = p.id
   where r.solicitud_id = v_sol.id and p.suspendido = false;

  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre', c.nombre, 'cantidad', si.cantidad,
           'unidad', c.unidad, 'cubierto', si.cubierto)), '[]'::jsonb)
    into v_items
    from public.solicitud_items si
    join public.catalogo_items c on c.id = si.item_id
   where si.solicitud_id = v_sol.id;

  return jsonb_build_object(
    'id', v_sol.id, 'codigo', v_sol.codigo, 'municipio', v_sol.municipio,
    'barrio', v_sol.barrio, 'categoria', v_sol.categoria, 'nota', v_sol.nota,
    'estado', v_sol.estado, 'expira_at', v_sol.expira_at,
    'items', v_items, 'respuestas', v_resp
  );
end;
$$;

grant execute on function public.leer_solicitud(text) to anon, authenticated;

-- Renovar 72 horas
create or replace function public.renovar_solicitud(p_token text)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare v_expira timestamptz;
begin
  update public.solicitudes
     set expira_at = now() + interval '72 hours', confirmada_at = now()
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
     and estado = 'abierta'
  returning expira_at into v_expira;

  if not found then raise exception 'Solicitud no encontrada'; end if;
  return v_expira;
end;
$$;

grant execute on function public.renovar_solicitud(text) to anon, authenticated;

-- Cerrar: registra métrica y BORRA de verdad
create or replace function public.cerrar_solicitud(p_token text, p_cumplida boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_sol public.solicitudes;
begin
  select * into v_sol from public.solicitudes
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if not found then raise exception 'Solicitud no encontrada'; end if;

  insert into public.metricas (
    municipio, categoria, cumplida, horas_hasta_respuesta,
    horas_hasta_cierre, num_respuestas)
  select v_sol.municipio, v_sol.categoria, p_cumplida,
         extract(epoch from (min(r.creada_at) - v_sol.creada_at)) / 3600,
         extract(epoch from (now() - v_sol.creada_at)) / 3600,
         count(r.id)
    from public.respuestas r where r.solicitud_id = v_sol.id;

  delete from public.solicitudes where id = v_sol.id;   -- CASCADE limpia todo
end;
$$;

grant execute on function public.cerrar_solicitud(text, boolean) to anon, authenticated;

-- Guardar suscripción push (con token, sin cuenta)
create or replace function public.guardar_push(
  p_token text, p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  select id into v_id from public.solicitudes
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if not found then raise exception 'Solicitud no encontrada'; end if;

  insert into public.push_suscripciones (solicitud_id, endpoint, p256dh, auth_key)
  values (v_id, p_endpoint, p_p256dh, p_auth)
  on conflict (solicitud_id, endpoint) do nothing;
end;
$$;

grant execute on function public.guardar_push(text,text,text,text) to anon, authenticated;

-- Avisos del lado de quien ofrece. Aquí no hay token: la persona tiene
-- cuenta, así que se identifica con auth.uid().
create or replace function public.guardar_push_ofertador(
  p_endpoint text, p_p256dh text, p_auth text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Debes iniciar sesión'; end if;
  if not exists (select 1 from public.perfiles p where p.id = v_uid) then
    raise exception 'Necesitas completar tu perfil';
  end if;

  insert into public.push_ofertadores (perfil_id, endpoint, p256dh, auth_key)
  values (v_uid, p_endpoint, p_p256dh, p_auth)
  on conflict (perfil_id, endpoint) do nothing;
end;
$$;

revoke execute on function public.guardar_push_ofertador(text,text,text) from public, anon;
grant  execute on function public.guardar_push_ofertador(text,text,text) to authenticated;

-- Con endpoint borra solo ESTE dispositivo: apagar los avisos en el
-- celular no debe apagarlos también en el computador. Sin endpoint,
-- borra todos (se usa al cerrar la cuenta).
create or replace function public.quitar_push_ofertador(p_endpoint text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Debes iniciar sesión'; end if;

  if p_endpoint is null then
    delete from public.push_ofertadores where perfil_id = v_uid;
  else
    delete from public.push_ofertadores
     where perfil_id = v_uid and endpoint = p_endpoint;
  end if;
end;
$;

revoke execute on function public.quitar_push_ofertador(text) from public, anon;
grant  execute on function public.quitar_push_ofertador(text) to authenticated;

-- Crea o actualiza el perfil de quien ofrece (ofertador o servidor).
-- El id sale de auth.uid(): el cliente nunca lo elige, y el correo de
-- Google no llega hasta aquí en ningún caso.
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

  if p_tipo not in ('ofertador','servidor') then
    raise exception 'Tipo de perfil inválido';
  end if;

  if array_length(p_municipios, 1) is null then
    raise exception 'Elige al menos un municipio';
  end if;

  insert into public.perfiles (
    id, nombre_visible, tipo, municipios, contacto_publico,
    contacto_tipo, descripcion, acepto_publicacion, acepto_politica_at)
  values (
    v_uid, p_nombre_visible, p_tipo, p_municipios, p_contacto_publico,
    p_contacto_tipo, nullif(trim(p_descripcion), ''), true, now())
  on conflict (id) do update set
    nombre_visible     = excluded.nombre_visible,
    tipo               = excluded.tipo,
    municipios         = excluded.municipios,
    contacto_publico   = excluded.contacto_publico,
    contacto_tipo      = excluded.contacto_tipo,
    descripcion        = excluded.descripcion,
    acepto_publicacion = true,
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

-- Responder una solicitud. Se identifica por código público, nunca por token:
-- quien ofrece jamás necesita ni recibe el token del solicitante.
create or replace function public.responder_solicitud(p_codigo text, p_mensaje text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_solicitud_id uuid;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if not exists (select 1 from public.perfiles p
                  where p.id = v_uid and p.suspendido = false) then
    raise exception 'Necesitas completar tu perfil antes de responder';
  end if;

  select s.id into v_solicitud_id
    from public.solicitudes s
   where s.codigo = upper(trim(p_codigo))
     and s.estado = 'abierta'
     and s.expira_at > now();

  if v_solicitud_id is null then
    raise exception 'Esa solicitud ya no está disponible';
  end if;

  if exists (select 1 from public.respuestas r
              where r.solicitud_id = v_solicitud_id and r.autor_id = v_uid) then
    raise exception 'Ya respondiste esta solicitud';
  end if;

  insert into public.respuestas (solicitud_id, autor_id, mensaje)
  values (v_solicitud_id, v_uid, trim(p_mensaje));

  return v_solicitud_id;
end;
$$;

revoke execute on function public.responder_solicitud(text,text) from public, anon;
grant  execute on function public.responder_solicitud(text,text) to authenticated;

-- Reportar contenido. Abierto a cualquiera, con o sin cuenta.
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
  if p_tipo_objeto not in ('solicitud','respuesta','perfil') then
    raise exception 'Tipo de contenido inválido';
  end if;
  if p_motivo not in ('datos_personales','estafa','contenido_ofensivo',
                      'informacion_falsa','menor_de_edad','otro') then
    raise exception 'Motivo inválido';
  end if;

  insert into public.reportes (tipo_objeto, objeto_id, motivo, nota)
  values (p_tipo_objeto, p_objeto_id, p_motivo, nullif(trim(p_nota), ''));
end;
$$;

grant execute on function public.crear_reporte(text,uuid,text,text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 9b. RPC de administración — todas comprueban es_admin() por dentro
-- ---------------------------------------------------------------------

create or replace function public.verificar_servidor(p_perfil_id uuid, p_verificado boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  update public.servidores
     set verificado = p_verificado,
         verificado_at = case when p_verificado then now() else null end,
         verificado_por = case when p_verificado then auth.uid() else null end
   where perfil_id = p_perfil_id;
end;
$$;

revoke execute on function public.verificar_servidor(uuid,boolean) from public, anon;
grant  execute on function public.verificar_servidor(uuid,boolean) to authenticated;

create or replace function public.suspender_perfil(p_perfil_id uuid, p_suspendido boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;
  update public.perfiles set suspendido = p_suspendido where id = p_perfil_id;
end;
$$;

revoke execute on function public.suspender_perfil(uuid,boolean) from public, anon;
grant  execute on function public.suspender_perfil(uuid,boolean) to authenticated;

-- Borra el contenido reportado (borrado duro) y cierra el reporte.
create or replace function public.resolver_reporte(p_reporte_id uuid, p_borrar boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_rep public.reportes;
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  select * into v_rep from public.reportes where id = p_reporte_id;
  if not found then raise exception 'Reporte no encontrado'; end if;

  if p_borrar then
    if v_rep.tipo_objeto = 'solicitud' then
      delete from public.solicitudes where id = v_rep.objeto_id;
    elsif v_rep.tipo_objeto = 'respuesta' then
      delete from public.respuestas where id = v_rep.objeto_id;
    elsif v_rep.tipo_objeto = 'perfil' then
      update public.perfiles set suspendido = true where id = v_rep.objeto_id;
    end if;
  end if;

  update public.reportes set atendido = true where id = p_reporte_id;
end;
$$;

revoke execute on function public.resolver_reporte(uuid,boolean) from public, anon;
grant  execute on function public.resolver_reporte(uuid,boolean) to authenticated;

-- El administrador necesita leer la ficha completa para poder verificarla.
create policy "admin lee perfiles" on public.perfiles
  for select to authenticated using (exists (select 1 from public.administradores a where a.user_id = (select auth.uid())));
create policy "admin lee servidores" on public.servidores
  for select to authenticated using (exists (select 1 from public.administradores a where a.user_id = (select auth.uid())));

-- ---------------------------------------------------------------------
-- 10. Expiración — borrado duro cada hora
-- ---------------------------------------------------------------------

create or replace function public.expirar_solicitudes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_n integer;
begin
  insert into public.metricas (
    municipio, categoria, cumplida, horas_hasta_respuesta,
    horas_hasta_cierre, num_respuestas)
  select s.municipio, s.categoria, false,
         extract(epoch from (min(r.creada_at) - s.creada_at)) / 3600,
         extract(epoch from (s.expira_at - s.creada_at)) / 3600,
         count(r.id)
    from public.solicitudes s
    left join public.respuestas r on r.solicitud_id = s.id
   where s.expira_at <= now()
   group by s.id, s.municipio, s.categoria, s.creada_at, s.expira_at;

  delete from public.solicitudes where expira_at <= now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Postgres concede EXECUTE a PUBLIC por defecto, así que estas dos quedaban
-- expuestas en la API REST sin que nadie las concediera: cualquiera podía
-- disparar el borrado masivo desde internet. Son internas.
revoke execute on function public.expirar_solicitudes() from public, anon, authenticated;
revoke execute on function public.generar_codigo() from public, anon, authenticated;

select cron.schedule(
  'expirar-solicitudes',
  '0 * * * *',
  $$select public.expirar_solicitudes();$$
);

-- ---------------------------------------------------------------------
-- 11. Semilla mínima
-- ---------------------------------------------------------------------

insert into public.municipios (codigo_dane, nombre, departamento) values
  ('76001','Cali','Valle del Cauca'),
  ('66001','Pereira','Risaralda'),
  ('17001','Manizales','Caldas'),
  ('63001','Armenia','Quindío'),
  ('27001','Quibdó','Chocó'),
  ('27660','San José del Palmar','Chocó'),
  ('76109','Buenaventura','Valle del Cauca'),
  ('27361','Istmina','Chocó')
on conflict (codigo_dane) do nothing;

insert into public.catalogo_items (id, categoria, nombre, unidad, orden) values
  ('agua','alimentacion','Agua embotellada','litro',1),
  ('formula_inicio','alimentacion','Fórmula infantil de inicio','tarro',2),
  ('leche_polvo','alimentacion','Leche en polvo','tarro',3),
  ('arroz','alimentacion','Arroz','libra',4),
  ('atun','alimentacion','Atún enlatado','lata',5),
  ('panela','alimentacion','Panela','libra',6),
  ('aceite','alimentacion','Aceite','botella',7),
  ('panales_1','aseo','Pañales etapa 1','paquete',10),
  ('panales_2','aseo','Pañales etapa 2','paquete',11),
  ('panales_3','aseo','Pañales etapa 3','paquete',12),
  ('toallas_h','aseo','Toallas higiénicas','paquete',13),
  ('jabon','aseo','Jabón','unidad',14),
  ('papel_h','aseo','Papel higiénico','rollo',15),
  ('acetaminofen','salud','Acetaminofén','caja',20),
  ('suero_oral','salud','Suero oral','sobre',21),
  ('gasas','salud','Gasas','paquete',22),
  ('cobija','abrigo','Cobija','unidad',30),
  ('colchoneta','abrigo','Colchoneta','unidad',31),
  ('carpa','abrigo','Carpa','unidad',32),
  ('olla','cocina','Olla','unidad',40),
  ('pimpina','cocina','Pimpina para agua','unidad',41),
  ('linterna','otros','Linterna','unidad',50),
  ('pilas','otros','Pilas','paquete',51)
on conflict (id) do nothing;
