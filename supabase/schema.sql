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
  id            text primary key,          -- PK legible, no uuid
  categoria     text not null check (categoria in
                  ('alimentacion','aseo','salud','abrigo','cocina','otros','servicios','mascotas')),
  nombre        text not null,
  unidad        text not null default 'unidad',
  activo        boolean not null default true,
  orden         integer not null default 0,
  creado_por    uuid references auth.users(id) on delete set null,
  origen        text not null default 'semilla'
                  check (origen in ('semilla','admin','aliado','sugerencia'))
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

-- Lo que alguien pidió y no estaba en el catálogo. La solicitud se publica
-- igual, con el ítem marcado "por confirmar"; después un administrador
-- aprueba, rechaza o fusiona con un ítem que ya existía. Sin la fusión
-- terminaríamos con "crema dental", "crema de dientes" y "pasta dental"
-- como tres ítems distintos, y el cruce dejaría de encontrar nada.
create table if not exists public.sugerencias_item (
  id                  uuid primary key default gen_random_uuid(),
  nombre_propuesto    text not null check (char_length(trim(nombre_propuesto)) between 2 and 60),
  categoria_sugerida  text check (categoria_sugerida in
                        ('alimentacion','aseo','salud','abrigo','cocina','otros','servicios','mascotas')),
  unidad_sugerida     text check (char_length(unidad_sugerida) between 1 and 20),
  -- SET NULL y no cascada: si quien la propuso borra su cuenta, la
  -- sugerencia sobrevive. No es un dato suyo, es el nombre de una cosa.
  propuesta_por       uuid references auth.users(id) on delete set null,
  origen              text not null check (origen in ('solicitante','ofertador','aliado')),
  estado              text not null default 'pendiente'
                        check (estado in ('pendiente','aprobada','rechazada','fusionada')),
  item_resultante_id  text references public.catalogo_items(id) on delete set null,
  revisada_por        uuid references auth.users(id) on delete set null,
  revisada_at         timestamptz,
  nota_revision       text check (char_length(nota_revision) <= 300),
  creada_at           timestamptz not null default now()
);

comment on table public.sugerencias_item is
  'PROHIBIDO usarla como campo de notas. Es el nombre de una cosa, nunca de una persona ni de una situación. El filtro de teléfonos y correos vive en las RPC que escriben. Ver CLAUDE.md regla 2.';

create index if not exists idx_sugerencias_estado on public.sugerencias_item(estado);

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

-- Inventario de quien ofrece: qué tiene, para poder cruzar en los dos
-- sentidos y no solo de solicitud hacia oferta. Es OPCIONAL — hay
-- ofertadores registrados sin él y obligarlos produce datos inventados,
-- que envenenan el cruce. Sin columna de categoría a propósito: un
-- ofertador cruza categorías libremente.
--
-- `cantidad` es NULLABLE, al revés que `solicitud_items.cantidad`: "tengo
-- cobijas, no sé cuántas" es el caso honesto más común. La cifra dura se
-- establece en la entrega, cuando alguien tiene la caja enfrente.
create table if not exists public.ofrecimientos (
  id             uuid primary key default gen_random_uuid(),
  perfil_id      uuid not null references public.perfiles(id) on delete cascade,
  item_id        text references public.catalogo_items(id),
  sugerencia_id  uuid references public.sugerencias_item(id) on delete restrict,
  cantidad       numeric(8,2) check (cantidad is null or (cantidad > 0 and cantidad <= 9999)),
  disponible     boolean not null default true,
  actualizado_at timestamptz not null default now(),
  constraint ofrecimientos_uno_u_otro check (num_nonnulls(item_id, sugerencia_id) = 1)
);

comment on table public.ofrecimientos is
  'Inventario de quien ofrece. Sin datos personales: ítems y cantidades colgando de un perfil.';

-- ⚠ Índices únicos PARCIALES y no restricción de tabla: un UNIQUE de tabla
-- no admite WHERE, y sin el WHERE los NULL de la columna que no aplica no
-- se comparan entre sí y el índice no serviría de nada.
create unique index if not exists ofrecimientos_item_uniq
  on public.ofrecimientos (perfil_id, item_id) where item_id is not null;
create unique index if not exists ofrecimientos_sug_uniq
  on public.ofrecimientos (perfil_id, sugerencia_id) where sugerencia_id is not null;
create index if not exists idx_ofrecimientos_item on public.ofrecimientos(item_id)
  where disponible;

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
  expira_at       timestamptz not null default now() + interval '72 hours',
  -- Temporal, mientras dure el periodo de pruebas. La deriva
  -- `crear_solicitud` del prefijo del barrio y la propagan
  -- `cerrar_solicitud` y `expirar_solicitudes` a `metricas`, que no tiene
  -- FK por donde limpiar después. Se elimina al terminar las pruebas.
  es_prueba       boolean not null default false
);

comment on table public.solicitudes is
  'PROHIBIDO agregar columnas con datos personales. Ver CLAUDE.md regla 1.';

create index if not exists idx_solicitudes_municipio on public.solicitudes(municipio);
create index if not exists idx_solicitudes_categoria on public.solicitudes(categoria);
create index if not exists idx_solicitudes_expira    on public.solicitudes(expira_at);
create index if not exists idx_solicitudes_token     on public.solicitudes(token_hash);

-- Un ítem apunta al catálogo O a una sugerencia, nunca a los dos ni a
-- ninguno. `on delete restrict` en `sugerencia_id`: borrar la sugerencia
-- dejaría esta fila violando su propio CHECK. Las sugerencias no se
-- borran, cambian de estado.
create table if not exists public.solicitud_items (
  id              uuid primary key default gen_random_uuid(),
  solicitud_id    uuid not null references public.solicitudes(id) on delete cascade,
  item_id         text references public.catalogo_items(id),
  sugerencia_id   uuid references public.sugerencias_item(id) on delete restrict,
  cantidad        numeric(8,2) not null check (cantidad > 0 and cantidad <= 9999),
  cubierto        boolean not null default false,
  constraint solicitud_items_uno_u_otro check (num_nonnulls(item_id, sugerencia_id) = 1)
);

create index if not exists idx_items_solicitud  on public.solicitud_items(solicitud_id);
create index if not exists idx_items_sugerencia on public.solicitud_items(sugerencia_id);

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
  registrada_at           timestamptz not null default now(),
  -- Sin esta columna no habría forma de identificar después las filas que
  -- dejan las solicitudes de prueba: esta tabla no tiene ninguna FK y para
  -- cuando uno quiera limpiarla ya no existe la solicitud que la originó.
  -- `/datos` publica siempre con `es_prueba = false`.
  es_prueba               boolean not null default false
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
  -- ⚠ `left join` porque un ítem sugerido no tiene fila en el catálogo, y
  -- `coalesce` sobre las TRES columnas, no solo sobre el nombre: la
  -- agregación usa `c.nombre`, `c.unidad` y `order by c.orden`. Con el
  -- left join a secas, `unidad` queda en NULL y `describirItem()` en
  -- src/lib/catalogo.ts renderiza "3 null de Crema dental" aquí, en el
  -- tablero público. Los sugeridos van al final: `coalesce(c.orden, 9999)`.
  (select coalesce(jsonb_agg(jsonb_build_object(
             'nombre',        coalesce(c.nombre, sg.nombre_propuesto),
             'cantidad',      si.cantidad,
             'unidad',        coalesce(c.unidad, sg.unidad_sugerida, 'unidad'),
             'por_confirmar', si.sugerencia_id is not null
           ) order by coalesce(c.orden, 9999)), '[]'::jsonb)
     from public.solicitud_items si
     left join public.catalogo_items c    on c.id = si.item_id
     left join public.sugerencias_item sg on sg.id = si.sugerencia_id
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
alter table public.sugerencias_item   enable row level security;
alter table public.ofrecimientos      enable row level security;

-- Nadie lee `solicitudes` directamente. Solo la vista y las RPC.
revoke all on public.solicitudes        from anon, authenticated;
revoke all on public.push_suscripciones from anon, authenticated;
revoke all on public.push_ofertadores    from anon, authenticated;
-- Igual que `solicitudes`: cero políticas es deliberado. La frontera son
-- `guardar_ofrecimientos` y `mis_ofrecimientos`, no una política.
revoke all on public.ofrecimientos      from anon, authenticated;
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

-- Sugerencias: nadie escribe directo, solo por RPC. La única lectura de
-- tabla es la del administrador, que necesita la cola en /admin. El resto
-- del mundo las ve resueltas dentro del jsonb de las vistas y las RPC.
create policy "admin lee sugerencias" on public.sugerencias_item
  for select to authenticated
  using (exists (select 1 from public.administradores a where a.user_id = (select auth.uid())));

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
  v_id          uuid;
  v_codigo      text;
  v_item        jsonb;
  v_sugerencia  text;
  v_sug_id      uuid;
  v_n_sugeridos integer := 0;
begin
  if p_nota is not null and p_nota ~ '(\+?57)?[ -]?3[0-9]{9}|[0-9]{7,}|@[a-zA-Z0-9._-]+\.[a-z]{2,}' then
    raise exception 'La nota no puede contener teléfonos ni correos';
  end if;

  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 12 then
    raise exception 'Debe incluir entre 1 y 12 ítems';
  end if;

  v_codigo := public.generar_codigo();

  -- La marca de prueba se deriva del prefijo del barrio en vez de recibirse
  -- por parámetro: así no cambia la firma —agregarle un argumento a esta
  -- función con `create or replace` crea una sobrecarga y PostgREST
  -- devuelve PGRST203 en cada llamada—, no se puede olvidar, y una
  -- solicitud de prueba publicada desde la interfaz real queda marcada
  -- sola. El prefijo ya es obligatorio: `barrio` se ve en la tarjeta del
  -- tablero público y quien la lea tiene que entender que es una prueba
  -- antes de invertir un viaje.
  insert into public.solicitudes (codigo, token_hash, municipio, barrio, categoria, nota, es_prueba)
  values (v_codigo, encode(extensions.digest(p_token, 'sha256'), 'hex'),
          p_municipio, p_barrio, p_categoria, nullif(trim(p_nota), ''),
          trim(p_barrio) ilike 'prueba%')
  returning id into v_id;

  -- Cada ítem viene en una de dos formas:
  --   {"item_id":"agua","cantidad":5}            ← del catálogo
  --   {"sugerencia":"Crema dental","cantidad":3} ← escrita por la persona
  --
  -- El tope de 3 sugerencias acota el daño: esta función la llama `anon`, y
  -- doce cadenas libres por envío convertirían la cola de moderación en el
  -- cuello de botella. Turnstile ya filtra bots; esto filtra insistencia.
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_sugerencia := nullif(trim(v_item->>'sugerencia'), '');

    if v_sugerencia is null then
      insert into public.solicitud_items (solicitud_id, item_id, cantidad)
      values (v_id, v_item->>'item_id', (v_item->>'cantidad')::numeric);
    else
      v_n_sugeridos := v_n_sugeridos + 1;
      if v_n_sugeridos > 3 then
        raise exception 'Puedes sugerir máximo 3 cosas que no estén en la lista';
      end if;

      if char_length(v_sugerencia) < 2 or char_length(v_sugerencia) > 60 then
        raise exception 'El nombre de lo que sugieres debe tener entre 2 y 60 caracteres';
      end if;

      -- Mismo patrón que la nota: es texto libre que entra desde fuera.
      if v_sugerencia ~ '(\+?57)?[ -]?3[0-9]{9}|[0-9]{7,}|@[a-zA-Z0-9._-]+\.[a-z]{2,}' then
        raise exception 'El nombre de lo que sugieres no puede contener teléfonos ni correos';
      end if;

      insert into public.sugerencias_item (nombre_propuesto, categoria_sugerida, origen)
      values (v_sugerencia, p_categoria, 'solicitante')
      returning id into v_sug_id;

      insert into public.solicitud_items (solicitud_id, sugerencia_id, cantidad)
      values (v_id, v_sug_id, (v_item->>'cantidad')::numeric);
    end if;
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

  -- Mismo left join con coalesce triple que `solicitudes_publicas`: sin él,
  -- el ítem sugerido no aparecería aquí, ni siquiera para quien lo pidió.
  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre',        coalesce(c.nombre, sg.nombre_propuesto),
           'cantidad',      si.cantidad,
           'unidad',        coalesce(c.unidad, sg.unidad_sugerida, 'unidad'),
           'cubierto',      si.cubierto,
           'por_confirmar', si.sugerencia_id is not null
         ) order by coalesce(c.orden, 9999)), '[]'::jsonb)
    into v_items
    from public.solicitud_items si
    left join public.catalogo_items c    on c.id = si.item_id
    left join public.sugerencias_item sg on sg.id = si.sugerencia_id
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
    horas_hasta_cierre, num_respuestas, es_prueba)
  select v_sol.municipio, v_sol.categoria, p_cumplida,
         extract(epoch from (min(r.creada_at) - v_sol.creada_at)) / 3600,
         extract(epoch from (now() - v_sol.creada_at)) / 3600,
         count(r.id), v_sol.es_prueba
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
as $$
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
$$;

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

-- Reemplaza el inventario completo del perfil que llama. Cada ítem viene
-- en una de tres formas, y exactamente una:
--
--   {"item_id":"agua","cantidad":40}            ← del catálogo
--   {"sugerencia_id":"<uuid>","cantidad":null}  ← sugerencia ya guardada
--   {"sugerencia":"Crema dental"}               ← sugerencia nueva
--
-- `cantidad` y `disponible` son opcionales en las tres.
create or replace function public.guardar_ofrecimientos(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := auth.uid();
  v_item        jsonb;
  v_sugerencia  text;
  v_sug_id      uuid;
  v_n_sugeridos integer := 0;
begin
  if v_uid is null then raise exception 'Debes iniciar sesión'; end if;

  if not exists (select 1 from public.perfiles p where p.id = v_uid) then
    raise exception 'Necesitas completar tu perfil';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Formato de inventario inválido';
  end if;

  -- No es un límite de producto: es una guarda de tamaño de payload en un
  -- endpoint que escribe. Ningún inventario real se acerca.
  if jsonb_array_length(p_items) > 100 then
    raise exception 'Son demasiados ítems de una sola vez';
  end if;

  delete from public.ofrecimientos where perfil_id = v_uid;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_sugerencia := nullif(trim(v_item->>'sugerencia'), '');
    v_sug_id     := nullif(v_item->>'sugerencia_id', '')::uuid;

    if v_sugerencia is not null then
      v_n_sugeridos := v_n_sugeridos + 1;
      if v_n_sugeridos > 3 then
        raise exception 'Puedes sugerir máximo 3 cosas nuevas a la vez';
      end if;

      if char_length(v_sugerencia) < 2 or char_length(v_sugerencia) > 60 then
        raise exception 'El nombre de lo que sugieres debe tener entre 2 y 60 caracteres';
      end if;

      if v_sugerencia ~ '(\+?57)?[ -]?3[0-9]{9}|[0-9]{7,}|@[a-zA-Z0-9._-]+\.[a-z]{2,}' then
        raise exception 'El nombre de lo que sugieres no puede contener teléfonos ni correos';
      end if;

      insert into public.sugerencias_item (nombre_propuesto, propuesta_por, origen)
      values (v_sugerencia, v_uid, 'ofertador')
      returning id into v_sug_id;

    elsif v_sug_id is not null then
      -- Solo sugerencias propias: sin esto, cualquiera podría enganchar su
      -- inventario a la sugerencia de otro pasando un uuid a mano.
      if not exists (select 1 from public.sugerencias_item sg
                      where sg.id = v_sug_id and sg.propuesta_por = v_uid) then
        raise exception 'Esa sugerencia no es tuya';
      end if;
    end if;

    insert into public.ofrecimientos (perfil_id, item_id, sugerencia_id, cantidad, disponible)
    values (
      v_uid,
      case when v_sug_id is null then v_item->>'item_id' else null end,
      v_sug_id,
      nullif(v_item->>'cantidad', '')::numeric,
      coalesce((v_item->>'disponible')::boolean, true)
    );
  end loop;
end;
$$;

revoke execute on function public.guardar_ofrecimientos(jsonb) from public, anon;
grant  execute on function public.guardar_ofrecimientos(jsonb) to authenticated;

-- Existe para que `ofrecimientos` no necesite ninguna política de lectura:
-- la pantalla de perfil llama esto y recibe los nombres ya resueltos,
-- vengan del catálogo o de una sugerencia todavía sin aprobar.
create or replace function public.mis_ofrecimientos()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_out jsonb;
begin
  if v_uid is null then raise exception 'Debes iniciar sesión'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'item_id',       o.item_id,
           'sugerencia_id', o.sugerencia_id,
           'nombre',        coalesce(c.nombre, sg.nombre_propuesto),
           'categoria',     coalesce(c.categoria, sg.categoria_sugerida),
           'unidad',        coalesce(c.unidad, sg.unidad_sugerida, 'unidad'),
           'cantidad',      o.cantidad,
           'disponible',    o.disponible,
           'por_confirmar', o.sugerencia_id is not null
         ) order by coalesce(c.orden, 9999), coalesce(c.nombre, sg.nombre_propuesto)), '[]'::jsonb)
    into v_out
    from public.ofrecimientos o
    left join public.catalogo_items c    on c.id = o.item_id
    left join public.sugerencias_item sg on sg.id = o.sugerencia_id
   where o.perfil_id = v_uid;

  return v_out;
end;
$$;

revoke execute on function public.mis_ofrecimientos() from public, anon;
grant  execute on function public.mis_ofrecimientos() to authenticated;

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

-- Sugerencias de ítem: aprobar, rechazar o fusionar.
--
-- `aprobar` y `fusionar` son la misma operación —apuntar todo lo que
-- referenciaba la sugerencia a un ítem del catálogo— y lo único que cambia
-- es si ese ítem se acaba de crear o ya existía. Tratarlas como una sola es
-- lo que evita que aprobar deje filas en "por confirmar" para siempre.
--
-- Y ninguna de las dos termina al escribir `estado`: hay que remapear las
-- filas que ya apuntaban a la sugerencia, o un ofertador con
-- `sugerencia_id = X` y una solicitud con `item_id = crema_dental` dejan de
-- cruzar para siempre.

create or replace function public.slug_item(p_nombre text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_base text;
  v_try  text;
  v_n    integer := 1;
begin
  v_base := lower(trim(p_nombre));
  v_base := translate(v_base, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN');
  v_base := regexp_replace(v_base, '[^a-z0-9]+', '_', 'g');
  v_base := trim(both '_' from v_base);
  v_base := left(v_base, 40);

  if v_base = '' then
    raise exception 'Ese nombre no sirve para crear un ítem';
  end if;

  v_try := v_base;
  while exists (select 1 from public.catalogo_items c where c.id = v_try) loop
    v_n := v_n + 1;
    v_try := left(v_base, 37) || '_' || v_n;
  end loop;

  return v_try;
end;
$$;

revoke execute on function public.slug_item(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Alta manual de un ítem
-- ---------------------------------------------------------------------

create or replace function public.crear_item_catalogo(
  p_nombre    text,
  p_categoria text,
  p_unidad    text default 'unidad'
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  text;
begin
  if not public.es_admin(v_uid) then
    raise exception 'No autorizado';
  end if;

  if char_length(trim(p_nombre)) < 2 or char_length(trim(p_nombre)) > 60 then
    raise exception 'El nombre debe tener entre 2 y 60 caracteres';
  end if;

  v_id := public.slug_item(p_nombre);

  insert into public.catalogo_items (id, categoria, nombre, unidad, orden, creado_por, origen)
  values (v_id, p_categoria, trim(p_nombre),
          coalesce(nullif(trim(p_unidad), ''), 'unidad'), 9999, v_uid, 'admin');

  return v_id;
end;
$$;

revoke execute on function public.crear_item_catalogo(text,text,text) from public, anon;
grant  execute on function public.crear_item_catalogo(text,text,text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Resolver una sugerencia
--
-- `aprobar` y `fusionar` son la misma operación: apuntar todo lo que
-- referenciaba la sugerencia a un ítem del catálogo. Lo único que cambia
-- es si ese ítem se acaba de crear o ya existía. Tratarlas como una sola
-- es lo que garantiza que aprobar tampoco deje filas colgando en "por
-- confirmar" para siempre.
--
-- En la Fase D esto lo podrá llamar también un aliado activo. Hoy solo
-- administrador: el rol todavía no existe.
-- ---------------------------------------------------------------------

create or replace function public.resolver_sugerencia(
  p_sugerencia_id uuid,
  p_accion        text,             -- 'aprobar' | 'rechazar' | 'fusionar'
  p_item_destino  text default null, -- solo para 'fusionar'
  p_nota          text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := auth.uid();
  v_sug     public.sugerencias_item;
  v_destino text;
  v_estado  text;
begin
  if not public.es_admin(v_uid) then
    raise exception 'No autorizado';
  end if;

  if p_accion not in ('aprobar','rechazar','fusionar') then
    raise exception 'Acción inválida';
  end if;

  select * into v_sug from public.sugerencias_item where id = p_sugerencia_id;
  if not found then raise exception 'Sugerencia no encontrada'; end if;
  if v_sug.estado <> 'pendiente' then
    raise exception 'Esa sugerencia ya fue resuelta';
  end if;

  if p_accion = 'rechazar' then
    update public.sugerencias_item
       set estado = 'rechazada', revisada_por = v_uid, revisada_at = now(),
           nota_revision = nullif(trim(p_nota), '')
     where id = p_sugerencia_id;
    return null;
  end if;

  if p_accion = 'aprobar' then
    v_destino := public.slug_item(v_sug.nombre_propuesto);
    insert into public.catalogo_items (id, categoria, nombre, unidad, orden, creado_por, origen)
    values (v_destino,
            coalesce(v_sug.categoria_sugerida, 'otros'),
            trim(v_sug.nombre_propuesto),
            coalesce(nullif(trim(v_sug.unidad_sugerida), ''), 'unidad'),
            9999, v_uid, 'sugerencia');
    v_estado := 'aprobada';
  else
    v_destino := p_item_destino;
    if v_destino is null then
      raise exception 'Indica con qué ítem se fusiona';
    end if;
    if not exists (select 1 from public.catalogo_items c where c.id = v_destino) then
      raise exception 'Ese ítem no existe en el catálogo';
    end if;
    v_estado := 'fusionada';
  end if;

  -- ⚠ Antes del remapeo: si un perfil ya tenía el ítem destino Y la
  -- sugerencia, el update chocaría contra `ofrecimientos_item_uniq`. Se
  -- descarta la fila de la sugerencia, que es la duplicada. No se suman
  -- las cantidades porque en el inventario son estimaciones, no cifras.
  delete from public.ofrecimientos o
   where o.sugerencia_id = p_sugerencia_id
     and exists (select 1 from public.ofrecimientos o2
                  where o2.perfil_id = o.perfil_id and o2.item_id = v_destino);

  update public.ofrecimientos
     set item_id = v_destino, sugerencia_id = null, actualizado_at = now()
   where sugerencia_id = p_sugerencia_id;

  -- ⚠ Y en `solicitud_items` el problema es al revés: no hay índice único,
  -- así que el remapeo NO falla — deja dos filas del mismo ítem en la misma
  -- solicitud, y el tablero público muestra "4 unidad de Jabón" y "3 unidad
  -- de Jabón" una debajo de otra, que se lee como un error. Aquí sí se
  -- suman: es lo que la persona necesita, y la suma es la cifra correcta.
  update public.solicitud_items dst
     set cantidad = least(9999, dst.cantidad + src.cantidad)
    from public.solicitud_items src
   where src.sugerencia_id = p_sugerencia_id
     and dst.solicitud_id = src.solicitud_id
     and dst.item_id = v_destino;

  delete from public.solicitud_items src
   where src.sugerencia_id = p_sugerencia_id
     and exists (select 1 from public.solicitud_items d
                  where d.solicitud_id = src.solicitud_id and d.item_id = v_destino);

  update public.solicitud_items
     set item_id = v_destino, sugerencia_id = null
   where sugerencia_id = p_sugerencia_id;

  update public.sugerencias_item
     set estado = v_estado, item_resultante_id = v_destino,
         revisada_por = v_uid, revisada_at = now(),
         nota_revision = nullif(trim(p_nota), '')
   where id = p_sugerencia_id;

  return v_destino;
end;
$$;

revoke execute on function public.resolver_sugerencia(uuid,text,text,text) from public, anon;
grant  execute on function public.resolver_sugerencia(uuid,text,text,text) to authenticated;

-- ---------------------------------------------------------------------
-- 4. La cola, con candidatos para fusionar
--
-- Existe por un error que apareció probando: el catálogo ya tenía
-- "Cepillo de dientes" y aprobar la sugerencia del mismo nombre creó
-- `cepillo_de_dientes` al lado de `cepillo_dientes` — exactamente la
-- duplicación que la fusión existe para evitar. Aprobar es un clic más
-- fácil que fusionar, así que si la pantalla no pone el ítem parecido
-- enfrente, nadie va a ir a buscarlo.
--
-- La coincidencia es por palabras de 4 letras o más, sin tildes. No hace
-- falta `pg_trgm` para esto y no vale la pena instalarla.
-- ---------------------------------------------------------------------

create or replace function public.sugerencias_pendientes()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_out jsonb;
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id',                 sg.id,
           'nombre_propuesto',   sg.nombre_propuesto,
           'categoria_sugerida', sg.categoria_sugerida,
           'origen',             sg.origen,
           'creada_at',          sg.creada_at,
           'usos',               (select count(*) from public.solicitud_items si
                                   where si.sugerencia_id = sg.id)
                               + (select count(*) from public.ofrecimientos o
                                   where o.sugerencia_id = sg.id),
           'parecidos', (
             select coalesce(jsonb_agg(jsonb_build_object(
                      'id', c.id, 'nombre', c.nombre, 'categoria', c.categoria)), '[]'::jsonb)
               from public.catalogo_items c
              where c.activo
                and exists (
                  select 1 from unnest(string_to_array(
                           lower(translate(sg.nombre_propuesto, 'áéíóúü', 'aeiouu')), ' ')) w
                   where char_length(w) >= 4
                     and lower(translate(c.nombre, 'áéíóúü', 'aeiouu')) like '%' || w || '%')
           )
         ) order by sg.creada_at), '[]'::jsonb)
    into v_out
    from public.sugerencias_item sg
   where sg.estado = 'pendiente';

  return v_out;
end;
$$;

revoke execute on function public.sugerencias_pendientes() from public, anon;
grant  execute on function public.sugerencias_pendientes() to authenticated;

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
    horas_hasta_cierre, num_respuestas, es_prueba)
  select s.municipio, s.categoria, false,
         extract(epoch from (min(r.creada_at) - s.creada_at)) / 3600,
         extract(epoch from (s.expira_at - s.creada_at)) / 3600,
         count(r.id), s.es_prueba
    from public.solicitudes s
    left join public.respuestas r on r.solicitud_id = s.id
   where s.expira_at <= now()
   group by s.id, s.municipio, s.categoria, s.creada_at, s.expira_at, s.es_prueba;

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
