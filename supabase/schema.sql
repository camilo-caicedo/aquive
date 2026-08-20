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
                  check (origen in ('semilla','admin','aliado','sugerencia')),
  -- Temporal. La propagan `resolver_sugerencia` y `crear_item_catalogo`.
  -- Hace falta porque `creado_por` es el administrador, que es una cuenta
  -- real: por ahí no se distingue un ítem creado probando de uno de verdad,
  -- y un ítem huérfano sale en la lista de publicar. Ninguna pantalla
  -- filtra por ella: en pruebas hay que poder ver lo que uno crea.
  es_prueba     boolean not null default false
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
  creada_at           timestamptz not null default now(),
  -- Temporal. Se hereda de la solicitud o del perfil que la propuso, y no
  -- se deduce después: `resolver_sugerencia` borra esa referencia al
  -- remapear, que es justo su trabajo.
  es_prueba           boolean not null default false
);

comment on table public.sugerencias_item is
  'PROHIBIDO usarla como campo de notas. Es el nombre de una cosa, nunca de una persona ni de una situación. El filtro de teléfonos y correos vive en las RPC que escriben. Ver CLAUDE.md regla 2.';

create index if not exists idx_sugerencias_estado on public.sugerencias_item(estado);

-- ---------------------------------------------------------------------
-- 1. El validador de enlaces
--
-- Es la superficie nueva más delicada del proyecto: botones que sacan a
-- gente vulnerable hacia sitios que no controlamos.
--
-- ⚠ LISTA BLANCA DE UN SOLO ESQUEMA, nunca lista negra. `javascript:`,
-- `data:`, `vbscript:`, `blob:` y `file:` no se enumeran en ninguna parte:
-- quedan fuera por no estar aquí. Una lista negra pierde siempre contra
-- `java\tscript:`, `JaVaScRiPt:` o `\x01javascript:`.
--
-- `http://` también queda fuera. El público entra por wifi de albergue y
-- datos compartidos: una página en claro es reescribible en tránsito. Si
-- una entidad no tiene TLS, esa entidad no debería tener botón.
--
-- `tel:` y `mailto:` tampoco, y no es purismo: la regla 3 dice que el
-- contacto nunca pasa por la plataforma. Si mañana hace falta el teléfono
-- de una entidad, va como columna propia con su propio tratamiento, no
-- como enlace libre en un campo que ningún control mira.
--
-- `immutable` y sin subconsultas a tablas, para poder usarla dentro de un
-- CHECK. La llaman DOS sitios a propósito: el CHECK de la tabla, para que
-- una fila mala no pueda existir ni escribiéndola desde el editor SQL, y
-- `guardar_entidad`, para que el administrador lea un mensaje en vez de un
-- error crudo de Postgres — igual que `crear_item_catalogo` con la
-- categoría.
--
-- Gemela de `esEnlaceSeguro` en src/lib/validacion.ts. Si cambia una,
-- cambia la otra.
-- ---------------------------------------------------------------------

create or replace function public.enlaces_validos(p_enlaces jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_enlaces) = 'array'
     and jsonb_array_length(p_enlaces) <= 6
     and not exists (
       select 1 from jsonb_array_elements(p_enlaces) e
        where jsonb_typeof(e) <> 'object'
           or (select count(*) from jsonb_object_keys(e) k
                where k not in ('etiqueta','url')) > 0
           or e->>'etiqueta' is null
           or e->>'url'      is null
           or char_length(trim(e->>'etiqueta')) not between 2 and 40
           or char_length(e->>'url') not between 12 and 200
           or e->>'url' !~ '^https://[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+(:([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5]))?(/[!-~]*)?$'
           or e->>'url' ~ '[^ -~]'
           or e->>'url' like '%@%'
           or e->>'url' ~ '[[:space:]<>"'']'
     );
$$;

revoke execute on function public.enlaces_validos(jsonb) from public, anon, authenticated;

comment on function public.enlaces_validos(jsonb) is
  'Gemela de esEnlaceSeguro en src/lib/validacion.ts. Si cambia una, cambia la otra. Lista blanca de https:// — nunca la conviertas en lista negra. El EXECUTE revocado no estorba al CHECK porque todas las rutas de escritura corren como postgres: guardar_entidad y resolver_reporte son security definer suyas, y el editor SQL también. Si algún día se le concede INSERT sobre entidades a otro rol, ese insert fallará con «permission denied for function» en vez del mensaje pensado.';

-- ---------------------------------------------------------------------
-- 2. La tabla
--
-- `cobertura` existe para que el filtro de municipio sea correcto: una
-- entidad nacional también atiende en Cali, así que filtrar por Cali tiene
-- que devolver las locales de Cali Y todas las nacionales. Lo nacional
-- cubre además lo virtual, que no está atado a ningún municipio.
-- ---------------------------------------------------------------------

create table if not exists public.entidades (
  id             uuid primary key default gen_random_uuid(),
  nombre         text not null check (char_length(trim(nombre)) between 3 and 80),
  subtitulo      text check (char_length(subtitulo) between 1 and 120),
  descripcion    text check (char_length(descripcion) <= 600),
  -- [{"etiqueta":"...","url":"https://..."}]. El ORDEN DEL ARRAY es el
  -- orden en pantalla: por eso jsonb y no tabla aparte — reordenar es
  -- mover un elemento, no N updates de una columna.
  enlaces        jsonb not null default '[]'::jsonb,
  -- Nota de cierre libre: horarios, cobertura, aclaraciones. Es texto
  -- libre, pero lo escribe el responsable del proyecto, no un usuario: la
  -- restricción de la regla 2 aquí es la longitud más el hecho de que la
  -- única ruta de escritura exige `es_admin()`.
  pie            text check (char_length(pie) <= 400),
  cobertura      text not null default 'nacional'
                   check (cobertura in ('nacional','local')),
  municipios     text[] not null default '{}',
  orden          integer not null default 0,
  activa         boolean not null default true,
  -- ⚠ SET NULL, jamás CASCADE. `limpiar-pruebas.sql` borra cuentas de
  -- `auth.users` por prefijo de uuid; con CASCADE eso se llevaría fichas
  -- reales creadas desde una cuenta de prueba con permisos de admin. Y si
  -- el administrador ejerce su derecho de supresión, un NO ACTION le haría
  -- fallar el borrado. Mismo criterio que `servidores.verificado_por`.
  creada_por     uuid references auth.users(id) on delete set null,
  creada_at      timestamptz not null default now(),
  actualizada_at timestamptz not null default now(),
  -- Temporal. La deriva `guardar_entidad` del prefijo del NOMBRE, que es
  -- un campo visible, nunca por parámetro. `creada_por` es el admin, que
  -- es una cuenta real: por ahí no se distingue una ficha de prueba.
  es_prueba      boolean not null default false,
  -- Una entidad local sin municipios quedaría invisible en el filtro y
  -- nadie sabría por qué.
  constraint entidades_cobertura_coherente
    check (cobertura = 'nacional' or array_length(municipios, 1) >= 1)
);

-- `add constraint` no es idempotente; el par drop/add sí, y además
-- revalida las filas que ya estuvieran.
alter table public.entidades drop constraint if exists entidades_enlaces_validos;
alter table public.entidades add  constraint entidades_enlaces_validos
  check (public.enlaces_validos(enlaces));

comment on table public.entidades is
  'Directorio SIN AVAL. Aparecer aquí no es recomendación ni verificación. Antes de enlazar, mirar dos cosas: que el destino no sea una página de donación —el plan Hobby de Vercel las cuenta como uso comercial, ver PLAN-V2 §13.8— y que la regla 5 no se esté eludiendo por la vía de enlazar a un tercero. Mismo espíritu que el comentario de catalogo_servicios.';

comment on column public.entidades.pie is
  'Nota de cierre libre del administrador: horarios, cobertura, aclaraciones. Puede llevar el teléfono de la organización — eso no es dato personal de una persona. No lleva filtro de PII a propósito, a diferencia de la nota de una solicitud, porque quien escribe aquí es el responsable del proyecto y no un usuario.';

comment on column public.entidades.enlaces is
  'Array [{etiqueta,url}] validado por el CHECK entidades_enlaces_validos. Solo https://, sin arroba, solo ASCII, máximo 6.';

create index if not exists idx_entidades_activa on public.entidades(activa, orden);

-- ---------------------------------------------------------------------
-- 2. Perfiles (ofertadores y servidores) — aquí SÍ hay datos personales
-- ---------------------------------------------------------------------

create table if not exists public.perfiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  nombre_visible      text not null check (char_length(nombre_visible) between 3 and 60),
  -- 'aliado' no se elige en /registro: lo pone `unirse_a_organizacion`.
  tipo                text not null check (tipo in ('ofertador','servidor','aliado')),
  municipios          text[] not null default '{}',
  -- Contacto PÚBLICO: la persona acepta explícitamente que se muestre.
  -- NULL solo para un aliado, que no tiene ficha pública: el trato con él
  -- ocurre dentro de una coordinación, no en un directorio.
  contacto_publico    text,
  contacto_tipo       text not null default 'whatsapp'
                        check (contacto_tipo in ('whatsapp','telefono')),
  descripcion         text check (char_length(descripcion) <= 300),
  acepto_publicacion  boolean not null default false,
  acepto_politica_at  timestamptz not null default now(),
  suspendido          boolean not null default false,
  creado_at           timestamptz not null default now(),
  -- Hasta cuándo miró sus avisos. Sustituye a una tabla de notificaciones
  -- con estado leído/no leído: con esta marca, lo nuevo es lo posterior.
  avisos_vistos_at    timestamptz,
  -- Siempre en positivo: marcado afirma que puede desplazarse, sin marcar
  -- no afirma nada. Nunca «no puedo» — ver la nota de `puede_recoger`.
  puede_trasladarse   boolean not null default false,
  constraint perfiles_contacto_publico_check check (
    case
      when tipo = 'aliado'
        then contacto_publico is null
          or char_length(contacto_publico) between 7 and 40
      else char_length(contacto_publico) between 7 and 40
    end
  )
);

comment on column public.perfiles.contacto_publico is
  'Dato personal deliberadamente público. Requiere acepto_publicacion = true. NULL solo para tipo = aliado: a un aliado no se le publica contacto en ninguna pantalla, el trato con él ocurre dentro de una coordinación.';

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
-- 2b. Organizaciones aliadas (Flujo 2) — ver migración v2-d1
--
-- Dos actos separados: la organización la crea un ADMINISTRADOR —nunca se
-- auto-registra, y por eso no hay columna `verificada`— y las personas se
-- unen contra ella trayendo su `slug`. El slug identifica, el código
-- autoriza: quien llega sin código cae en una cola donde no ve nada.
-- ---------------------------------------------------------------------

create table if not exists public.organizaciones (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null check (char_length(trim(nombre)) between 3 and 80),
  tipo             text not null default 'fundacion'
                     check (tipo in ('fundacion','corporacion','entidad_publica','junta','otra')),
  nit              text not null unique check (nit ~ '^[0-9]{5,15}(-[0-9])?$'),
  -- Identifica, no autoriza. Va en la URL de /unirse y en el QR.
  slug             text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  municipios       text[] not null default '{}'
                     check (array_length(municipios, 1) >= 1),
  -- Dirección de un acopio, no de una persona: una bodega con horario.
  direccion_acopio text check (char_length(direccion_acopio) <= 200),
  horario_acopio   text check (char_length(horario_acopio) <= 200),
  activa           boolean not null default true,
  -- SET NULL y no CASCADE, por lo mismo que `entidades.creada_por`.
  creada_por       uuid references auth.users(id) on delete set null,
  creada_at        timestamptz not null default now(),
  actualizada_at   timestamptz not null default now(),
  es_prueba        boolean not null default false
);

comment on table public.organizaciones is
  'Aliadas del Flujo 2. LAS CREA UN ADMIN, jamás se auto-registran. Si la fila existe, alguien ya miró el certificado del RUES y el NIT: por eso no hay columna verificada. Ver PLAN-V2 §5.5.';

create table if not exists public.invitaciones_organizacion (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid not null references public.organizaciones(id) on delete cascade,
  -- ⚠ En claro, al revés que `solicitudes.token_hash`: el coordinador
  -- tiene que poder reimprimir el QR de la pared. Lo que lo acota es que
  -- caduca, se agota por usos y se desactiva de un clic.
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
  'En claro a propósito: el coordinador tiene que poder reimprimir el QR. Caduca, se agota por usos y se desactiva de un clic. Nunca aparece en un log ni en una query string de la aplicación (regla 6): viaja en el path de /unirse/[slug]/[codigo] o en el body.';

create index if not exists idx_invitaciones_org
  on public.invitaciones_organizacion(organizacion_id, activa);

create table if not exists public.miembros_organizacion (
  organizacion_id       uuid not null references public.organizaciones(id) on delete cascade,
  perfil_id             uuid not null references public.perfiles(id) on delete cascade,
  rol                   text not null default 'miembro'
                          check (rol in ('coordinador','miembro')),
  estado                text not null default 'pendiente'
                          check (estado in ('pendiente','activo','inactivo')),
  -- ⚠ NUNCA nace en true: lo impide `tr_permiso_identidad_al_insertar`.
  puede_ver_identidad   boolean not null default false,
  puede_moderar         boolean not null default false,
  invitacion_id         uuid references public.invitaciones_organizacion(id) on delete set null,
  creado_at             timestamptz not null default now(),
  aprobado_por          uuid references public.perfiles(id) on delete set null,
  aprobado_at           timestamptz,
  permiso_identidad_por uuid references public.perfiles(id) on delete set null,
  permiso_identidad_at  timestamptz,
  primary key (organizacion_id, perfil_id)
);

comment on column public.miembros_organizacion.puede_ver_identidad is
  'El permiso más sensible del sistema. Solo lo cambia otorgar_permiso_miembro, y queda registrado en permiso_identidad_por / _at. Un trigger BEFORE INSERT impide que nazca en true, incluso escribiendo desde el editor SQL.';

create index if not exists idx_miembros_perfil
  on public.miembros_organizacion(perfil_id);

-- Pertenencia. ⚠ Al revés que `es_admin()`, estas llevan el EXECUTE
-- CONCEDIDO: tienen que poder usarse dentro de una política RLS, y
-- encapsular la pertenencia aquí es lo que evita la recursión infinita
-- entre `miembros_organizacion` y `conversaciones` (PLAN-V2 §5.3-4).
--
-- Las tres condiciones van juntas de una vez —miembro activo, de una
-- organización activa— para que ninguna RPC futura tenga que acordarse.
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

-- Invariante 1: `puede_ver_identidad` nunca nace en true.
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

-- Invariante 2: una organización con miembros no se queda sin coordinador
-- activo. Trigger y no comprobación en la RPC porque son cuatro caminos
-- —degradar, desactivar, borrar el miembro, borrar el perfil— y el último
-- ni siquiera pasa por una RPC de aliado. `deferrable` para que un traspaso
-- en dos pasos dentro de una transacción no falle a mitad de camino.
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

revoke execute on function public.bloquear_permiso_identidad() from public, anon, authenticated;
revoke execute on function public.exigir_coordinador()         from public, anon, authenticated;

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
  -- `en_coordinacion` y `entregada_parcial` los escriben las Fases G y H.
  -- Quien filtre por estado usa `estado_activo()`, nunca `= 'abierta'`:
  -- esa es la trampa §5.3-1 del plan, y hacía desaparecer del tablero una
  -- solicitud en coordinación.
  estado          text not null default 'abierta'
                    check (estado in ('abierta','en_coordinacion','entregada_parcial','cumplida')),
  -- Flujo 1 o Flujo 2. `acompanado` significa que una organización aliada
  -- coordina la entrega y que existe una fila en `identidades` colgando de
  -- esta solicitud. Solo se pasa de uno a otro por
  -- `activar_acompanamiento`; el camino de vuelta es automático (§7).
  flujo           text not null default 'directo'
                    check (flujo in ('directo','acompanado')),
  -- SET NULL y no CASCADE: si la organización se borra, la solicitud NO se
  -- va con ella. Quien pidió ayuda no pierde su solicitud porque la
  -- fundación dejó de operar.
  organizacion_id uuid references public.organizaciones(id) on delete set null,
  -- Cuándo entró la fundación. Sin fecha no se puede avisar a quien ya
  -- había ofrecido ayuda de que ahora hay quien coordine.
  acompanamiento_at timestamptz,
  -- ⚠ NO va en `solicitudes_publicas`, que la lee `anon`. Un tablero
  -- filtrable por esto sería un directorio de a quién le cuesta moverse, y
  -- eso es lo que la regla 1 prohíbe guardar. Se lee con el token, con
  -- `movilidad_solicitud` si hay sesión, o en el panel de la fundación.
  puede_recoger   boolean not null default false,
  -- Nota PUBLICA del administrador, del estilo "esto ya se entrego". Con
  -- filtro de PII a diferencia de `entidades.pie`: aquel describe una
  -- organizacion, este la entrega a una persona.
  nota_admin      text check (char_length(nota_admin) <= 200),
  nota_admin_at   timestamptz,
  nota_admin_por  uuid references auth.users(id) on delete set null,
  creada_at       timestamptz not null default now(),
  confirmada_at   timestamptz not null default now(),
  expira_at       timestamptz not null default now() + interval '72 hours',
  -- Temporal, mientras dure el periodo de pruebas. La deriva
  -- `crear_solicitud` del prefijo del barrio y la propagan
  -- `cerrar_solicitud` y `expirar_solicitudes` a `metricas`, que no tiene
  -- FK por donde limpiar después. Se elimina al terminar las pruebas.
  es_prueba       boolean not null default false,
  -- `directo` no puede tener organización y `acompanado` no puede quedarse
  -- sin ella. Va como CHECK y no como buena costumbre porque las dos rutas
  -- que lo escriben son distintas.
  constraint solicitudes_flujo_coherente check (
    (flujo = 'directo'    and organizacion_id is null)
    or (flujo = 'acompanado' and organizacion_id is not null)
  )
);

comment on table public.solicitudes is
  'PROHIBIDO agregar columnas con datos personales. Ver CLAUDE.md regla 1. La identidad del Flujo 2 NO va aquí: vive cifrada en `identidades`, colgando de esta fila y muriendo con ella.';

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

-- Contacto opcional que deja quien pide ayuda. Excepción explícita a la
-- regla 1 de CLAUDE.md, pedida el 17 de agosto de 2026 por el responsable
-- del proyecto — ver el comentario completo en
-- supabase/migraciones/v2-k4-contacto-solicitante.sql. Cuelga de la
-- solicitud y muere con ella; solo la lee el administrador y quien
-- responde esa solicitud puntual, nunca `solicitudes_publicas`.
create table if not exists public.solicitudes_contacto (
  solicitud_id uuid primary key references public.solicitudes(id) on delete cascade,
  nombre       text check (nombre is null or char_length(nombre) between 1 and 80),
  telefono     text check (telefono is null or telefono ~ '^[0-9+()\- ]{6,20}$'),
  correo       text check (correo is null or correo ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  consentimiento_version text,
  creada_at    timestamptz not null default now(),
  constraint solicitudes_contacto_tiene_algo check (
    nombre is not null or telefono is not null or correo is not null
  ),
  constraint solicitudes_contacto_con_consentimiento check (
    consentimiento_version is not null
  )
);

create index if not exists idx_solicitudes_contacto_solicitud
  on public.solicitudes_contacto(solicitud_id);

revoke all on public.solicitudes_contacto from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Respuestas
-- ---------------------------------------------------------------------

create table if not exists public.respuestas (
  id              uuid primary key default gen_random_uuid(),
  solicitud_id    uuid not null references public.solicitudes(id) on delete cascade,
  autor_id        uuid not null references public.perfiles(id) on delete cascade,
  mensaje         text not null check (char_length(mensaje) between 5 and 200),
  -- Para ESTA entrega. Se precarga de `perfiles.puede_trasladarse` y se
  -- puede desmarcar: se puede tener carro y no poder ese día.
  puede_llevar    boolean not null default false,
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
  tipo_objeto     text not null check (tipo_objeto in ('solicitud','respuesta','perfil','entidad')),
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
  -- De qué flujo venía. Sin esto, la única pregunta interesante que se
  -- puede responder después —si acompañar sirvió de algo— queda sin
  -- respuesta, y esta tabla es lo que sobrevive al proyecto.
  flujo                   text not null default 'directo',
  -- Sin esta columna no habría forma de identificar después las filas que
  -- dejan las solicitudes de prueba: esta tabla no tiene ninguna FK y para
  -- cuando uno quiera limpiarla ya no existe la solicitud que la originó.
  -- `/datos` publica siempre con `es_prueba = false`.
  es_prueba               boolean not null default false
);

comment on table public.metricas is
  'Sin texto, sin ubicación fina, sin identificadores. Publicable como dato abierto.';

-- ---------------------------------------------------------------------
-- 6b. Identidad cifrada (Flujo 2) — ver migración v2-e1
--
-- 🔴 Los únicos datos personales de verdad del proyecto: nombre, documento
-- y teléfono. Cifrados con llave del Vault, aislados en su tabla, y con
-- fecha de muerte — cuelgan de la solicitud o del perfil y se van con
-- ellos (regla K).
--
-- Los dos secretos del Vault se crean A MANO en el dashboard y no viven en
-- ninguna otra parte:
--   aquive_identidad_key      llave simétrica de pgp_sym_encrypt
--   aquive_documento_pepper   pepper del hash de documento (regla P)
--
-- ⚠ `security definer` no basta: la función corre como su dueño, así que
-- tiene que ser propiedad de un rol con acceso al vault. Si no,
-- `secreto_vault` devuelve NULL y `cifrar_texto` revienta — que es lo que
-- tiene que pasar, en vez de guardar NULL.
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

-- `immutable` y aparte, porque el hash tiene que salir igual al guardar y
-- al buscar: si «1.020.304-5» y «10203045» no se normalizan igual,
-- `buscar_identidad_presencial` no encuentra a nadie.
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

-- Regla P. Una cédula tiene ~10 dígitos: un sha256 pelado se rompe por
-- fuerza bruta con un volcado de la base. El pepper vive en el Vault.
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

-- ⚠ LA LLAVE FORÁNEA VA DE AQUÍ HACIA AFUERA, nunca al revés (§5.7-1 del
-- plan). Poner `solicitudes.identidad_id` con CASCADE significaría «si
-- borro la identidad, borro la solicitud», y borrar la solicitud dejaría
-- la identidad huérfana, cifrada y para siempre.
create table if not exists public.identidades (
  id                 uuid primary key default gen_random_uuid(),
  solicitud_id       uuid references public.solicitudes(id) on delete cascade,
  perfil_id          uuid references public.perfiles(id)    on delete cascade,
  titular_tipo       text not null
                       check (titular_tipo in ('solicitante','ofertador','aliado')),
  nombre_cifrado     bytea not null,
  -- Regla O: sin datos de menores. TI y RC quedan fuera por CHECK, no por
  -- una validación de interfaz que mañana alguien cambia sin darse cuenta.
  documento_tipo     text not null check (documento_tipo in ('CC','CE','PEP','PPT')),
  documento_cifrado  bytea not null,
  documento_hash     text not null,
  -- En claro y a propósito (§5.6): para reconocer a quien se tiene
  -- enfrente sin descifrar nada. Nunca en pantalla pública, QR ni URL.
  documento_ultimos4 text not null check (documento_ultimos4 ~ '^[A-Z0-9]{1,4}$'),
  telefono_cifrado   bytea,
  telefono_hash      text,
  -- La prueba de que hubo consentimiento informado, y de cuál texto.
  autorizacion_version text not null check (char_length(trim(autorizacion_version)) between 3 and 40),
  autorizacion_at    timestamptz not null default now(),
  creada_at          timestamptz not null default now(),
  -- Se hereda de la solicitud o del perfil. No es por esta tabla —se va
  -- con ellos— sino por `accesos_identidad`, que sobrevive.
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

create unique index if not exists identidades_solicitud_uniq
  on public.identidades(solicitud_id) where solicitud_id is not null;
create unique index if not exists identidades_perfil_uniq
  on public.identidades(perfil_id) where perfil_id is not null;

-- Sin UNIQUE sobre el hash: la misma persona puede tener identidad colgada
-- de su perfil de ofertador y otra colgada de una solicitud suya.
create index if not exists idx_identidades_documento_hash
  on public.identidades(documento_hash);

-- Regla N. Sobrevive a lo que registra: `identidad_id` y `leida_por` en ON
-- DELETE SET NULL, con la copia en texto al lado para que la fila siga
-- diciendo algo. Sin PII. Mismo razonamiento que `servidores.verificado_por`.
create table if not exists public.accesos_identidad (
  id            uuid primary key default gen_random_uuid(),
  identidad_id  uuid references public.identidades(id) on delete set null,
  identidad_ref text not null,
  leida_por     uuid references auth.users(id) on delete set null,
  lector_ref    text not null,
  rol_lector    text not null check (rol_lector in ('admin','aliado')),
  -- «consulta» no es un motivo. Sin mínimo, la bitácora contaría accesos
  -- y no diligencia.
  motivo        text not null check (char_length(trim(motivo)) between 5 and 200),
  leida_at      timestamptz not null default now(),
  es_prueba     boolean not null default false
);

comment on table public.accesos_identidad is
  'Regla N: cada lectura de identidad deja rastro, y el rastro sobrevive al borrado de la identidad. Sin PII. Nadie tiene UPDATE ni DELETE sobre esta tabla, ni siquiera el administrador: se escribe una vez y no se toca.';

create index if not exists idx_accesos_identidad
  on public.accesos_identidad(identidad_id, leida_at desc);

-- ---------------------------------------------------------------------
-- 6c. Chat tripartito (Flujo 2) — ver migración v2-g1
--
-- Tres roles en el mismo hilo: quien pidió (por token), quien ofrece (por
-- sesión) y el aliado (por sesión). Dos reglas lo sostienen, y las dos
-- viven en la base:
--
--   L · Ninguna conversación puede ser bilateral. Un hilo sin aliado
--       asignado no acepta mensajes. Si se permite el aparte, no queda
--       nada que distinga al Flujo 2 del Flujo 1 salvo la recolección de
--       datos, que sería lo peor de los dos mundos.
--   M · El chat filtra datos de contacto. Sin esto la regla L es
--       decorativa.
--
-- El hilo NO es un archivo: muere con la solicitud, por CASCADE.
-- ---------------------------------------------------------------------

create table if not exists public.conversaciones (
  id              uuid primary key default gen_random_uuid(),
  solicitud_id    uuid not null references public.solicitudes(id) on delete cascade,
  -- ⚠ Los dos en SET NULL. Con CASCADE, borrar una cuenta —que es un
  -- derecho y ya está implementado— se llevaría el hilo entero, incluidos
  -- los mensajes de las otras dos personas; con NO ACTION, el borrado de
  -- cuenta empezaría a fallar (§5.7-4).
  ofertador_id    uuid references public.perfiles(id) on delete set null,
  aliado_id       uuid references public.perfiles(id) on delete set null,
  organizacion_id uuid references public.organizaciones(id) on delete set null,
  -- `asignada` existe por la regla L: sin ese estado, un hilo con
  -- organización pero sin persona a cargo quedaría «abierto» y sería
  -- bilateral de hecho.
  estado          text not null default 'esperando_aliado'
                    check (estado in ('esperando_aliado','asignada','abierta',
                                      'acordada','entregada','cerrada')),
  -- La fundación entrega de su bodega: no hay ofertador.
  --
  -- ⚠ NO se deduce de `ofertador_id is null`. Esa columna va en SET NULL, y
  -- también queda nula cuando el ofertador borra su cuenta —que es otra
  -- cosa—. Un índice único parcial sobre la nulidad haría FALLAR ese
  -- borrado si la solicitud ya tenía un hilo directo.
  directa         boolean not null default false,
  creada_at       timestamptz not null default now(),
  cerrada_at      timestamptz,
  unique (solicitud_id, ofertador_id),
  -- Seguro: SET NULL solo puede llevar `ofertador_id` a null, que es lo que
  -- este CHECK exige. Lo que NO puede ir aquí es `aliado_id is not null`:
  -- esa columna también es SET NULL y rompería el borrado del aliado.
  constraint conversaciones_directa_sin_ofertador
    check (not directa or ofertador_id is null)
);

create unique index if not exists conversaciones_directa_uniq
  on public.conversaciones (solicitud_id) where directa;

comment on table public.conversaciones is
  'Chat tripartito del Flujo 2. Muere con la solicitud (CASCADE). Sin tabla de participantes: los tres roles son columnas, y los dos que son cuentas van en SET NULL para no romper el borrado de cuenta.';

create index if not exists idx_conversaciones_solicitud
  on public.conversaciones(solicitud_id);
create index if not exists idx_conversaciones_organizacion
  on public.conversaciones(organizacion_id, estado);

create table if not exists public.mensajes (
  id              uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.conversaciones(id) on delete cascade,
  autor_rol       text not null
                    check (autor_rol in ('solicitante','ofertador','aliado','admin')),
  -- NULL para el solicitante, que no tiene cuenta, y para cuando la cuenta
  -- del autor se borre. El `autor_rol` sobrevive, así que el hilo se sigue
  -- leyendo.
  autor_perfil_id uuid references public.perfiles(id) on delete set null,
  cuerpo          text not null check (char_length(cuerpo) between 1 and 1000),
  creado_at       timestamptz not null default now(),
  -- Moderar oculta, no borra.
  oculto          boolean not null default false,
  oculto_por      uuid references auth.users(id) on delete set null,
  oculto_at       timestamptz
);

create index if not exists idx_mensajes_conversacion
  on public.mensajes(conversacion_id, creado_at);

-- Regla L, en la base.
--
-- ⚠ La excepción del mensaje inicial: `iniciar_conversacion` tiene que
-- poder guardar el primero mientras el hilo está en `asignada`, y lo hace
-- prendiendo `aquive.mensaje_inicial` en su transacción.
--
-- Lo que impide que un cliente prenda esa variable NO es que la RPC sea
-- `security definer` —eso es irrelevante aquí—: es que `set_config` vive
-- en `pg_catalog` y PostgREST no la expone. Si algún día se expone una
-- función que llame a `set_config` con un parámetro del cliente, esta
-- defensa cae y la regla L se puede saltar desde fuera.
create or replace function public.exigir_hilo_con_aliado()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado text;
begin
  select c.estado into v_estado
    from public.conversaciones c where c.id = new.conversacion_id;

  if v_estado in ('esperando_aliado','asignada')
     and coalesce(current_setting('aquive.mensaje_inicial', true), 'off') <> 'on' then
    raise exception 'Este hilo todavía no tiene a nadie de la fundación a cargo';
  end if;

  if v_estado in ('cerrada','entregada') then
    raise exception 'Esta conversación ya está cerrada';
  end if;

  return new;
end;
$$;

drop trigger if exists tr_hilo_con_aliado on public.mensajes;
create trigger tr_hilo_con_aliado
  before insert on public.mensajes
  for each row execute function public.exigir_hilo_con_aliado();

revoke execute on function public.exigir_hilo_con_aliado() from public, anon, authenticated;

-- Qué papel juega quien pregunta. Una sola función para no repetir la
-- condición en cinco RPC. NULL si no es nadie en ese hilo.
create or replace function public.rol_en_conversacion(p_conversacion_id uuid)
returns text
language sql
security definer
stable
set search_path = ''
as $$
  -- El rol de PARTICIPANTE gana sobre el de administrador: en un proyecto
  -- que opera una sola persona, el admin que ademas ofrece en ese hilo no
  -- es un caso raro, y aparecia como «Moderacion de AquiVe» al escribir.
  select case
    when exists (select 1 from public.conversaciones c
                  where c.id = p_conversacion_id and c.ofertador_id = auth.uid())
      then 'ofertador'
    when exists (select 1 from public.conversaciones c
                  where c.id = p_conversacion_id
                    and public.es_miembro_activo(c.organizacion_id, auth.uid()))
      then 'aliado'
    when public.es_admin(auth.uid()) then 'admin'
  end;
$$;

revoke execute on function public.rol_en_conversacion(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Vistas públicas — lo único que el cliente puede leer
-- ---------------------------------------------------------------------

-- Los estados en los que una solicitud sigue viva y visible. Si algún día
-- se agrega un estado, se agrega AQUÍ y no en cada consulta: los cuatro
-- sitios que filtraban «estado = abierta» a mano son la trampa §5.3-1.
create or replace function public.estado_activo(p_estado text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_estado in ('abierta','en_coordinacion','entregada_parcial');
$$;

-- ⚠ CON el EXECUTE concedido, y no revocado como el resto de ayudantes.
-- PostgreSQL comprueba los permisos de TABLA con el dueño de la vista,
-- pero los de FUNCION contra quien consulta. Con el revoke puesto,
-- cualquier lectura de solicitudes_publicas moria con «permission denied
-- for function estado_activo» — para todo el mundo, o sea el tablero
-- publico entero. Es la misma trampa que el esquema ya documenta para
-- es_admin() dentro de una politica RLS.
--
-- No filtra nada: recibe un texto y devuelve si esta en una lista de tres.
grant execute on function public.estado_activo(text) to anon, authenticated;

create or replace view public.solicitudes_publicas as
select
  s.id,
  s.codigo,
  s.municipio,
  m.nombre || ', ' || m.departamento as municipio_nombre,
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
    where si.solicitud_id = s.id) as items,
  -- Los identificadores, aparte del jsonb legible. Son lo que permite
  -- cruzar: el jsonb sirve para mostrar, estos para comparar.
  (select coalesce(array_agg(si.item_id) filter (where si.item_id is not null), '{}')
     from public.solicitud_items si where si.solicitud_id = s.id) as item_ids,
  (select coalesce(array_agg(si.sugerencia_id) filter (where si.sugerencia_id is not null), '{}')
     from public.solicitud_items si where si.solicitud_id = s.id) as sugerencia_ids,
  -- ⚠ El flujo, y NADA más de la organización ni de la identidad. Esta
  -- vista la lee `anon`: aquí no entra ni el nombre de quien pidió, ni los
  -- cuatro últimos dígitos de su documento, ni el id de la fundación.
  s.flujo,
  -- Texto del proyecto, no de quien pidio. Escrito para leerse aqui.
  s.nota_admin
from public.solicitudes s
join public.municipios m on m.codigo_dane = s.municipio
where public.estado_activo(s.estado)
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
where public.estado_activo(s.estado) and s.expira_at > now();

-- Directorio de quienes ofrecen insumos. A diferencia de
-- `servidores_publicos`, NO expone `contacto_publico`: el contacto ocurre
-- cuando el ofertador responde una solicitud, no al revés. Así se expone
-- menos dato y nadie queda sujeto a que lo llamen 200 personas a la vez.
-- Directorio de quienes ofrecen insumos. A diferencia de
-- `servidores_publicos`, NO expone `contacto_publico`: el contacto ocurre
-- cuando el ofertador responde una solicitud, no al revés. Así se expone
-- menos dato y nadie queda sujeto a que lo llamen 200 personas a la vez.
--
-- Sale quien tenga `tipo = ofertador` Y TAMBIÉN cualquiera que haya
-- declarado insumos: desde que el inventario dejó de ser exclusivo de los
-- ofertadores, alguien con matrícula que además tiene cobijas tiene que
-- poder verse en las dos listas. Un ofertador sin inventario sigue
-- saliendo: el inventario es opcional y no puede volverse un requisito
-- por la puerta de atrás.
--
-- ⚠ `items` trae los NOMBRES, nunca las cantidades. Una lista pública de
-- quién tiene cuántos litros de agua y dónde es un mapa de existencias, y
-- además el texto de autorización que la persona acepta enumera lo que se
-- publica: las cantidades no están ahí. Ver docs/legal/PLANTILLAS.md §3.
create or replace view public.ofertadores_publicos as
select
  p.id,
  p.nombre_visible,
  p.municipios,
  p.descripcion,
  p.creado_at,
  (select coalesce(jsonb_agg(x order by x->>'nombre'), '[]'::jsonb)
     from (
       select jsonb_build_object(
                'nombre',        coalesce(c.nombre, sg.nombre_propuesto),
                'por_confirmar', o.sugerencia_id is not null
              ) as x
         from public.ofrecimientos o
         left join public.catalogo_items c    on c.id = o.item_id
         left join public.sugerencias_item sg on sg.id = o.sugerencia_id
        where o.perfil_id = p.id and o.disponible
        order by coalesce(c.orden, 9999)
        limit 12
     ) t) as items,
  (select count(*) from public.ofrecimientos o
    where o.perfil_id = p.id and o.disponible) as total_items,
  -- Al final y no junto a `descripcion`, que es donde encajaría: `create or
  -- replace view` no deja meter una columna en medio, solo añadirla al
  -- final, y reordenarla exigiría un DROP.
  p.puede_trasladarse
from public.perfiles p
where p.suspendido = false
  and p.acepto_publicacion = true
  and (
    p.tipo = 'ofertador'
    or exists (select 1 from public.ofrecimientos o where o.perfil_id = p.id)
  );

grant select on public.ofertadores_publicos to anon, authenticated;

create or replace view public.municipios_con_ofertadores as
select distinct m.codigo_dane, m.nombre, m.departamento
from public.municipios m
join public.perfiles p on m.codigo_dane = any(p.municipios)
where p.suspendido = false
  and p.acepto_publicacion = true
  and (
    p.tipo = 'ofertador'
    or exists (select 1 from public.ofrecimientos o where o.perfil_id = p.id)
  );

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

create or replace view public.entidades_publicas as
select e.id, e.nombre, e.subtitulo, e.descripcion, e.enlaces, e.pie,
       e.cobertura, e.municipios, e.orden
from public.entidades e
where e.activa;

grant select on public.entidades_publicas to anon, authenticated;

-- Solo los municipios de las entidades locales: las nacionales están en
-- todos y no aportan nada al desplegable.
create or replace view public.municipios_con_entidades as
select distinct m.codigo_dane, m.nombre, m.departamento
from public.municipios m
join public.entidades e on m.codigo_dane = any(e.municipios)
where e.activa and e.cobertura = 'local';

grant select on public.municipios_con_entidades to anon, authenticated;

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
-- La consulta del cruce
--
-- Devuelve las solicitudes abiertas que piden alguno de los ítems
-- marcados, primero las que coinciden en más cosas.
--
-- La llama `anon` a propósito: ayudar no debería exigir cuenta. Quien sí
-- la tiene llega con su inventario precargado, pero es un atajo, no un
-- requisito.
--
-- No expone nada que no exponga ya el tablero: lee `solicitudes_publicas`,
-- que es la frontera de seguridad y no incluye `token_hash`.
-- ---------------------------------------------------------------------

create index if not exists idx_items_item on public.solicitud_items(item_id)
  where item_id is not null;

create or replace function public.solicitudes_que_calzan(
  p_item_ids  text[],
  p_municipio text default null,
  p_limite    integer default 20,
  p_desde     integer default 0
)
returns table (
  id               uuid,
  codigo           text,
  municipio        text,
  municipio_nombre text,
  barrio           text,
  categoria        text,
  nota             text,
  creada_at        timestamptz,
  confirmada_at    timestamptz,
  expira_at        timestamptz,
  horas_sin_confirmar numeric,
  num_respuestas   bigint,
  items            jsonb,
  coincidencias    integer
)
language plpgsql
security definer
set search_path = ''
stable
as $$
declare
  v_limite integer := least(greatest(coalesce(p_limite, 20), 1), 50);
  v_desde  integer := least(greatest(coalesce(p_desde, 0), 0), 10000);
begin
  if p_item_ids is null or cardinality(p_item_ids) = 0 then
    return;
  end if;
  if cardinality(p_item_ids) > 12 then
    raise exception 'Puedes marcar máximo 12 cosas a la vez';
  end if;

  return query
  with calces as (
    select si.solicitud_id, count(*)::integer as n
      from public.solicitud_items si
     where si.item_id = any(p_item_ids)
     group by si.solicitud_id
  )
  select sp.id, sp.codigo, sp.municipio, sp.municipio_nombre, sp.barrio,
         sp.categoria, sp.nota, sp.creada_at, sp.confirmada_at, sp.expira_at,
         sp.horas_sin_confirmar, sp.num_respuestas, sp.items, c.n
    from calces c
    join public.solicitudes_publicas sp on sp.id = c.solicitud_id
   where p_municipio is null or sp.municipio = p_municipio
   order by c.n desc, sp.creada_at desc
   limit v_limite offset v_desde;
end;
$$;

grant execute on function public.solicitudes_que_calzan(text[],text,integer,integer)
  to anon, authenticated;

create or replace function public.municipios_que_calzan(p_item_ids text[])
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'codigo_dane', t.municipio,
           'nombre',      t.municipio_nombre,
           'total',       t.total
         ) order by t.municipio_nombre), '[]'::jsonb)
  from (
    select sp.municipio, sp.municipio_nombre, count(*) as total
      from (
        select distinct si.solicitud_id
          from public.solicitud_items si
         where p_item_ids is not null
           and cardinality(p_item_ids) between 1 and 12
           and si.item_id = any(p_item_ids)
      ) c
      join public.solicitudes_publicas sp on sp.id = c.solicitud_id
     group by sp.municipio, sp.municipio_nombre
     -- Cota dura: el desplegable no puede crecer sin techo, y sin ella
     -- esta función agregaba la vista entera en cada llamada anónima.
     limit 100
  ) t;
$$;

grant execute on function public.municipios_que_calzan(text[]) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. A quién avisar, resuelto en la base
--
-- Antes se traían todos los `ofrecimientos` de los perfiles del municipio
-- y se cruzaba en TypeScript. Dos fallos silenciosos ahí:
--
--   · PostgREST corta en 1000 filas —el mismo tope que obligó a crear
--     `listar_municipios`— y la llave de servicio no exime. Con 150
--     perfiles de 10 ítems, la lista llegaba truncada y sin orden: alguien
--     con inventario podía quedar clasificado como "tiene, pero no calza"
--     y perderse justo el aviso que le interesaba.
--   · `.in('perfil_id', [...])` mete todos los uuid en el query string de
--     un GET. Con unos cientos de perfiles la URL revienta, la respuesta
--     vuelve nula, y el filtro desaparece entero sin ningún síntoma.
--
-- De paso deja de mandar uuid de personas por la URL (regla 6).
--
-- `tiene_inventario` NO mira `disponible`: quien marcó todo lo suyo como
-- no disponible está diciendo "ahora no", no "no me llenaste el perfil".
-- Devolverlo a la rama de "avísame todo" era lo contrario de lo que pidió.
-- ---------------------------------------------------------------------

create or replace function public.destinatarios_aviso(
  p_municipio text,
  p_item_ids  text[]
)
returns table (
  suscripcion_id uuid,
  endpoint       text,
  p256dh         text,
  auth_key       text,
  calza          boolean
)
language sql
security definer
set search_path = ''
stable
as $$
  select po.id, po.endpoint, po.p256dh, po.auth_key,
         coalesce(cal.calza, false)
    from public.push_ofertadores po
    join public.perfiles p on p.id = po.perfil_id
    left join lateral (
      select bool_or(o.item_id = any(p_item_ids)) as calza,
             count(*) > 0                        as tiene
        from public.ofrecimientos o
       where o.perfil_id = p.id
    ) inv on true
    left join lateral (
      select bool_or(o.item_id = any(p_item_ids)) as calza
        from public.ofrecimientos o
       where o.perfil_id = p.id and o.disponible
    ) cal on true
   where p.suspendido = false
     and p_municipio = any(p.municipios)
     -- Sin inventario declarado: recibe todo lo de sus municipios, como
     -- siempre. El inventario es opcional y no puede volverse el precio de
     -- enterarse.
     and (
       coalesce(inv.tiene, false) = false
       -- Con inventario: solo si la solicitud pide algo suyo…
       or coalesce(cal.calza, false)
       -- …o si la solicitud no trae ningún ítem del catálogo con el que
       -- cruzar, que pasa cuando todo lo que pidió es una sugerencia. Sin
       -- esto, quien se tomó el trabajo de declarar qué tiene era el único
       -- que no se enteraba.
       or p_item_ids is null
       or cardinality(p_item_ids) = 0
     );
$$;

revoke execute on function public.destinatarios_aviso(text,text[])
  from public, anon, authenticated;

-- Los otros dos de un hilo. Ver migración v2-i10.
--
-- Los tres participantes guardan su suscripción en sitios distintos, y eso
-- no es descuido: quien pide ayuda no tiene cuenta, así que la suya cuelga
-- de la solicitud y muere con ella; las de quien ofrece y quien coordina
-- cuelgan de su perfil. Por eso vuelve `de_solicitante`, para saber en qué
-- tabla borrar la que el navegador ya botó.
--
-- Solo el aliado A CARGO, no el equipo entero: un hilo sin nadie a cargo no
-- acepta mensajes (regla L), así que no hay caso en que valga la pena
-- despertar a cinco personas.
create or replace function public.destinatarios_conversacion(
  p_conversacion_id     uuid,
  p_excluir_perfil      uuid    default null,
  p_excluir_solicitante boolean default false
)
returns table (
  suscripcion_id uuid,
  de_solicitante boolean,
  endpoint       text,
  p256dh         text,
  auth_key       text,
  codigo         text
)
language sql
security definer
stable
set search_path = ''
as $$
  select ps.id, true, ps.endpoint, ps.p256dh, ps.auth_key, s.codigo
    from public.conversaciones c
    join public.solicitudes s        on s.id = c.solicitud_id
    join public.push_suscripciones ps on ps.solicitud_id = s.id
   where c.id = p_conversacion_id
     and p_excluir_solicitante = false

  union all

  select po.id, false, po.endpoint, po.p256dh, po.auth_key, s.codigo
    from public.conversaciones c
    join public.solicitudes s   on s.id = c.solicitud_id
    join public.perfiles p      on p.id in (c.ofertador_id, c.aliado_id)
    join public.push_ofertadores po on po.perfil_id = p.id
   where c.id = p_conversacion_id
     and p.suspendido = false
     and p.id is distinct from p_excluir_perfil;
$$;

revoke execute on function public.destinatarios_conversacion(uuid,uuid,boolean)
  from public, anon, authenticated;

-- Quienes ya habían ofrecido ayuda en una solicitud, para avisarles de que
-- ahora hay una fundación coordinándola: quien respondió hace dos días no
-- vuelve solo a mirar.
create or replace function public.destinatarios_respondieron(p_solicitud_id uuid)
returns table (
  suscripcion_id uuid,
  endpoint       text,
  p256dh         text,
  auth_key       text
)
language sql
security definer
stable
set search_path = ''
as $$
  select po.id, po.endpoint, po.p256dh, po.auth_key
    from public.respuestas r
    join public.perfiles p         on p.id = r.autor_id
    join public.push_ofertadores po on po.perfil_id = p.id
   where r.solicitud_id = p_solicitud_id
     and p.suspendido = false;
$$;

revoke execute on function public.destinatarios_respondieron(uuid)
  from public, anon, authenticated;

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
alter table public.entidades          enable row level security;
alter table public.organizaciones            enable row level security;
alter table public.invitaciones_organizacion enable row level security;
alter table public.miembros_organizacion     enable row level security;
alter table public.identidades               enable row level security;
alter table public.accesos_identidad         enable row level security;
alter table public.conversaciones            enable row level security;
alter table public.mensajes                  enable row level security;

-- Nadie lee `solicitudes` directamente. Solo la vista y las RPC.
revoke all on public.solicitudes        from anon, authenticated;
revoke all on public.push_suscripciones from anon, authenticated;
revoke all on public.push_ofertadores    from anon, authenticated;
-- Igual que `solicitudes`: cero políticas es deliberado. La frontera son
-- `guardar_ofrecimientos` y `mis_ofrecimientos`, no una política.
revoke all on public.ofrecimientos      from anon, authenticated;
revoke all on public.solicitud_items    from anon, authenticated;
-- El público no toca la tabla, toca `entidades_publicas`. Una sola
-- política, la del administrador, que necesita ver también las retiradas.
revoke all on public.entidades          from anon, authenticated;
-- Las tres del Flujo 2 van revocadas y con CERO políticas, como
-- `solicitudes`: la frontera son sus RPC. Es además la forma más corta de
-- no caer en la recursión de PLAN-V2 §5.3-4 — sin política que cruce
-- `miembros_organizacion` con nada, no hay ciclo posible.
revoke all on public.organizaciones            from anon, authenticated;
revoke all on public.invitaciones_organizacion from anon, authenticated;
revoke all on public.miembros_organizacion     from anon, authenticated;
-- Y las dos de identidad, por lo mismo y con más razón: un `select` sobre
-- `identidades`, aunque devolviera solo bytea, sería un volcado del
-- material cifrado — la mitad del trabajo de quien quiera romperlo.
revoke all on public.identidades               from anon, authenticated;
revoke all on public.accesos_identidad         from anon, authenticated;
-- Y las del chat. Aquí no hay alternativa a revocarlas: uno de los tres
-- participantes es anónimo con token, así que no hay `auth.uid()` con el
-- que escribir una política que lo incluya. La frontera son las RPC.
revoke all on public.conversaciones            from anon, authenticated;
revoke all on public.mensajes                  from anon, authenticated;
-- ⚠ Una política FILTRA privilegios, no los concede: sin este grant,
-- PostgREST —que conecta como `authenticated`— devolvía «permission denied»
-- para todo el mundo, el administrador incluido, y el panel listaba siempre
-- «No hay entidades». `solicitudes` lleva revoke y CERO políticas;
-- `sugerencias_item` lleva política y ningún revoke. Esta es del segundo
-- tipo. `anon` sigue sin nada: lo público sale de la vista.
grant select on public.entidades to authenticated;
create policy "admin lee entidades" on public.entidades
  for select to authenticated
  using (exists (select 1 from public.administradores a where a.user_id = (select auth.uid())));
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

-- Ítems: NO legibles por el cliente. Tuvo política `using (true)` hasta
-- agosto de 2026, y eso contradecía que la vista sea la frontera:
-- `GET /rest/v1/solicitud_items` devolvía los ítems de TODAS las
-- solicitudes, incluidas las cumplidas y las vencidas que el job todavía no
-- ha borrado, que es justo lo que `solicitudes_publicas` oculta. Nada de
-- `src/` la lee directo: todo pasa por la vista o por RPC.

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
  for select to public using (es_prueba = false);

-- Un `revoke select (columna)` NO sirve encima de un `grant select` de
-- tabla: el permiso de tabla cubre todas las columnas y el revoke de
-- columna no le resta nada. Hay que quitar el de tabla y volver a
-- conceder columna por columna. `creado_por` es el uuid de auth.users de
-- quien aprobó el ítem, y esta tabla la lee una página anónima.
revoke select on public.catalogo_items from anon, authenticated;
grant select (id, categoria, nombre, unidad, activo, orden, origen, es_prueba)
  on public.catalogo_items to anon, authenticated;

-- Sin esta política, `administradores` queda con RLS activo y cero reglas:
-- la consulta devuelve vacío incluso para un administrador real y /admin
-- se vuelve inaccesible. Cada quien solo puede ver su propia fila.
create policy "admin se ve a si mismo" on public.administradores
  for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.contiene_pii(p_texto text)
returns boolean
language sql
security definer
set search_path = ''
immutable
as $$
  select p_texto is not null
     and (
       -- Correo, o usuario de red social con arroba.
       p_texto ~* '@[a-zA-Z0-9._-]{2,}'
       -- Siete o más dígitos seguidos una vez quitados los separadores que
       -- la gente mete para que un número se lea mejor. Un celular
       -- colombiano tiene 10, un fijo 7 u 8, una cédula entre 8 y 10.
       or regexp_replace(p_texto, '[[:space:].()-]', '', 'g') ~ '\d{7,}'
     );
$$;

revoke execute on function public.contiene_pii(text) from public, anon, authenticated;

comment on function public.contiene_pii(text) is
  'Gemela de contienePII en src/lib/validacion.ts. Si cambia una, cambia la otra: son los dos lados del mismo control y ya se separaron una vez.';

-- Regla M — el filtro del chat (Fase G). Aparte de `contiene_pii` y más
-- estricta que ella, a propósito: aquella protege una nota de solicitud,
-- esta protege un canal de conversación, que es donde alguien va a
-- intentar en serio saltarse el filtro.
--
-- Gemela de `contieneContacto` en src/lib/validacion.ts.
create or replace function public.contiene_contacto(p_texto text)
returns boolean
language sql
security definer
immutable
set search_path = ''
as $$
  select p_texto is not null
     and (
       public.contiene_pii(p_texto)
       -- Enlaces de mensajería y de redes. No es una lista completa y no
       -- pretende serlo: cierra lo que la gente escribe de verdad.
       or p_texto ~* '(wa\.me|api\.whatsapp|chat\.whatsapp|whatsapp\.com|t\.me|telegram\.|m\.me|messenger\.com|instagram\.com|facebook\.com|linktr\.ee)'
       -- Una arroba pegada a cualquier cosa, aunque no parezca correo.
       or p_texto ~* '@[a-z0-9._-]'
       -- Cuatro o más dígitos seguidos escritos con letras. Cuatro y no
       -- tres para no reventar en «los tres niños de la casa dos».
       or lower(p_texto) ~ '((cero|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)[^[:alnum:]]+){3,}(cero|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)'
     );
$$;

revoke execute on function public.contiene_contacto(text) from public, anon, authenticated;

comment on function public.contiene_contacto(text) is
  'Regla M. Gemela de contieneContacto en src/lib/validacion.ts. Más estricta que contiene_pii: cubre además wa.me, t.me, arrobas sueltas y dígitos escritos con letras. Sin esto, la regla L es decorativa.';

-- ---------------------------------------------------------------------
-- 2. Las sugerencias sobrevivían al borrado duro
--
-- La llave foránea va de `solicitud_items` HACIA la sugerencia, así que el
-- CASCADE de `solicitudes` se lleva el ítem y deja la sugerencia. A las 72
-- horas la solicitud desaparecía y el texto que escribió esa persona se
-- quedaba en la tabla para siempre, sin job, sin TTL y sin ninguna ruta de
-- borrado en la aplicación. La regla 4 promete que al borrar solo
-- sobrevive una fila anónima en `metricas`, "sin texto".
--
-- Trigger y no un `delete` dentro de `expirar_solicitudes`: así cubre
-- también `cerrar_solicitud` y el `delete` directo de `resolver_reporte`,
-- que son otras dos rutas de borrado.
--
-- Las aprobadas y fusionadas se conservan: su texto ya pasó por moderación
-- y vive en `catalogo_items`, y `item_resultante_id` es lo que explica de
-- dónde salió un ítem del catálogo.
-- ---------------------------------------------------------------------

create or replace function public.limpiar_sugerencia_huerfana()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.sugerencia_id is null then
    return null;
  end if;

  delete from public.sugerencias_item sg
   where sg.id = old.sugerencia_id
     and sg.estado in ('pendiente','rechazada')
     and not exists (select 1 from public.solicitud_items si
                      where si.sugerencia_id = sg.id)
     and not exists (select 1 from public.ofrecimientos o
                      where o.sugerencia_id = sg.id);

  return null;
end;
$$;

-- ⚠ DEFERRABLE INITIALLY DEFERRED, y esto no es un detalle: corren al
-- COMMIT, no en el momento del `delete`.
--
-- Con un trigger normal se rompían dos cosas que se descubrieron probando:
--
--   · `guardar_ofrecimientos` empieza con `delete from ofrecimientos where
--     perfil_id = ...` y vuelve a insertar. En el instante del delete la
--     sugerencia se queda sin referencias, el trigger la borraba, y el
--     re-insert con ese `sugerencia_id` fallaba con "Esa sugerencia no es
--     tuya". O sea: guardar el inventario dos veces reventaba.
--   · `resolver_sugerencia` borra filas de `solicitud_items` en medio del
--     remapeo. El trigger se llevaba la sugerencia antes de que la función
--     alcanzara a escribirle `estado` e `item_resultante_id`, y el update
--     final no afectaba ninguna fila, en silencio.
--
-- Al COMMIT las referencias ya están puestas de vuelta y el estado ya está
-- escrito, así que el trigger solo alcanza lo que de verdad quedó huérfano.
drop trigger if exists trg_sugerencia_huerfana on public.solicitud_items;
create constraint trigger trg_sugerencia_huerfana
  after delete on public.solicitud_items
  deferrable initially deferred
  for each row execute function public.limpiar_sugerencia_huerfana();

drop trigger if exists trg_sugerencia_huerfana_ofr on public.ofrecimientos;
create constraint trigger trg_sugerencia_huerfana_ofr
  after delete on public.ofrecimientos
  deferrable initially deferred
  for each row execute function public.limpiar_sugerencia_huerfana();

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
  p_items       jsonb,
  p_token       text,
  p_puede_recoger boolean default false
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
  v_es_prueba   boolean := trim(p_barrio) ilike 'prueba%';
begin
  if public.contiene_pii(p_nota) then
    raise exception 'La nota no puede contener teléfonos ni correos';
  end if;

  -- El barrio también: se ve en la tarjeta del tablero público, igual que
  -- la nota, y hasta ahora solo lo filtraba el cliente.
  if public.contiene_pii(p_barrio) then
    raise exception 'El barrio no puede contener teléfonos ni correos';
  end if;

  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 12 then
    raise exception 'Debe incluir entre 1 y 12 ítems';
  end if;

  v_codigo := public.generar_codigo();

  insert into public.solicitudes (codigo, token_hash, municipio, barrio, categoria,
                                  nota, es_prueba, puede_recoger)
  values (v_codigo, encode(extensions.digest(p_token, 'sha256'), 'hex'),
          p_municipio, p_barrio, p_categoria, nullif(trim(p_nota), ''), v_es_prueba,
          coalesce(p_puede_recoger, false))
  returning id into v_id;

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

      if public.contiene_pii(v_sugerencia) then
        raise exception 'El nombre de lo que sugieres no puede contener teléfonos ni correos';
      end if;

      insert into public.sugerencias_item (nombre_propuesto, categoria_sugerida, origen, es_prueba)
      values (v_sugerencia, p_categoria, 'solicitante', v_es_prueba)
      returning id into v_sug_id;

      insert into public.solicitud_items (solicitud_id, sugerencia_id, cantidad)
      values (v_id, v_sug_id, (v_item->>'cantidad')::numeric);
    end if;
  end loop;

  return query select v_id, v_codigo;
end;
$$;

grant execute on function public.crear_solicitud(text,text,text,text,jsonb,text,boolean)
  to anon, authenticated;

-- Se escribe con el token, igual que `activar_acompanamiento`: solo quien
-- tiene el enlace de SU solicitud puede dejar un contacto en ella. No pide
-- sesión porque quien pide ayuda no tiene cuenta.
create or replace function public.agregar_contacto_solicitante(
  p_token    text,
  p_nombre   text default null,
  p_telefono text default null,
  p_correo   text default null,
  p_version  text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id       uuid;
  v_nombre   text := nullif(trim(p_nombre), '');
  v_telefono text := nullif(trim(p_telefono), '');
  v_correo   text := nullif(trim(p_correo), '');
begin
  if v_nombre is null and v_telefono is null and v_correo is null then
    return;
  end if;

  if p_version is null then
    raise exception 'Falta aceptar el aviso de privacidad';
  end if;

  select id into v_id from public.solicitudes
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  if not found then
    raise exception 'Solicitud no encontrada o vencida';
  end if;

  insert into public.solicitudes_contacto (solicitud_id, nombre, telefono, correo, consentimiento_version)
  values (v_id, v_nombre, v_telefono, v_correo, p_version)
  on conflict (solicitud_id) do update
    set nombre = excluded.nombre,
        telefono = excluded.telefono,
        correo = excluded.correo,
        consentimiento_version = excluded.consentimiento_version;
end;
$$;

grant execute on function public.agregar_contacto_solicitante(text,text,text,text,text)
  to anon, authenticated;

-- Lo lee quien va a responder ESA solicitud puntual — mismo patrón de
-- guardia que `movilidad_solicitud`: sesión con perfil activo, y solo
-- mientras la solicitud siga viva. Nunca `anon`.
create or replace function public.contacto_solicitante(p_codigo text)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select jsonb_build_object(
           'nombre', sc.nombre, 'telefono', sc.telefono, 'correo', sc.correo
         )
    from public.solicitudes s
    join public.solicitudes_contacto sc on sc.solicitud_id = s.id
   where s.codigo = upper(trim(p_codigo))
     and public.estado_activo(s.estado)
     and s.expira_at > now()
     and exists (select 1 from public.perfiles p
                  where p.id = auth.uid() and p.suspendido = false);
$$;

revoke execute on function public.contacto_solicitante(text) from public, anon;
grant  execute on function public.contacto_solicitante(text) to authenticated;

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
           'profesion', sv.profesion, 'verificado', coalesce(sv.verificado, false),
           'puede_llevar', r.puede_llevar
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
    'flujo', v_sol.flujo,
    -- Si ESTA solicitud tiene avisos, que no es lo mismo que si este
    -- navegador tiene una suscripción: un teléfono tiene una sola, y puede
    -- existir por el lado de quien ofrece.
    'tiene_avisos', exists (select 1 from public.push_suscripciones ps
                             where ps.solicitud_id = v_sol.id),
    'puede_recoger', v_sol.puede_recoger,
    -- El NOMBRE de la organización, nunca su identificador ni nada de la
    -- identidad: los datos que entregó no se le vuelven a mostrar.
    'organizacion', (select o.nombre from public.organizaciones o
                      where o.id = v_sol.organizacion_id),
    'items', v_items, 'respuestas', v_resp
  );
end;
$$;

grant execute on function public.leer_solicitud(text) to anon, authenticated;

-- Quien va a responder necesita saber si el otro puede recoger, justo
-- antes de escribir. RPC aparte y no una columna más en
-- `solicitudes_publicas` porque esa vista la lee `anon`: ahí el dato sería
-- público y filtrable, que es justo lo que no queremos. Aquí hace falta
-- sesión y perfil vivo.
create or replace function public.movilidad_solicitud(p_codigo text)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select s.puede_recoger
    from public.solicitudes s
   where s.codigo = upper(trim(p_codigo))
     and public.estado_activo(s.estado)
     and s.expira_at > now()
     and exists (select 1 from public.perfiles p
                  where p.id = auth.uid() and p.suspendido = false);
$$;

revoke execute on function public.movilidad_solicitud(text) from public, anon;
grant  execute on function public.movilidad_solicitud(text) to authenticated;

-- Lo que ya declaró en su perfil, para precargar la casilla al responder.
create or replace function public.mi_movilidad()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce((select p.puede_trasladarse from public.perfiles p
                    where p.id = auth.uid()), false);
$$;

revoke execute on function public.mi_movilidad() from public, anon;
grant  execute on function public.mi_movilidad() to authenticated;

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
     and public.estado_activo(estado)
  returning expira_at into v_expira;

  if not found then raise exception 'Solicitud no encontrada'; end if;
  return v_expira;
end;
$$;

grant execute on function public.renovar_solicitud(text) to anon, authenticated;

-- Cerrar: registra métrica y BORRA de verdad
-- `cerrar_solicitud` se define UNA sola vez, en el bloque de la Fase I:
-- allá deja de borrar a ciegas. Ver la migración v2-i1.

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
  p_servicios         text[] default '{}',
  p_puede_trasladarse boolean default false
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
  -- campos se descarta aquí, no se guarda «por si acaso». Nadie se declara
  -- aliado desde /registro; el tipo aparece al unirse a una organización, y
  -- esto existe para que un aliado pueda editar su nombre sin que la RPC lo
  -- rechace.
  insert into public.perfiles (
    id, nombre_visible, tipo, municipios, contacto_publico,
    contacto_tipo, descripcion, acepto_publicacion, acepto_politica_at,
    puede_trasladarse)
  values (
    v_uid, p_nombre_visible, p_tipo, p_municipios,
    case when p_tipo = 'aliado' then null else p_contacto_publico end,
    case when p_tipo = 'aliado' then 'whatsapp' else p_contacto_tipo end,
    nullif(trim(p_descripcion), ''),
    p_tipo <> 'aliado', now(),
    coalesce(p_puede_trasladarse, false))
  on conflict (id) do update set
    nombre_visible     = excluded.nombre_visible,
    tipo               = excluded.tipo,
    municipios         = excluded.municipios,
    contacto_publico   = excluded.contacto_publico,
    contacto_tipo      = excluded.contacto_tipo,
    descripcion        = excluded.descripcion,
    acepto_publicacion = excluded.acepto_publicacion,
    acepto_politica_at = now(),
    puede_trasladarse  = excluded.puede_trasladarse;

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

revoke execute on function public.crear_perfil(text,text,text[],text,text,text,text,text,text,text[],boolean)
  from public, anon;
grant  execute on function public.crear_perfil(text,text,text[],text,text,text,text,text,text,text[],boolean)
  to authenticated;

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
  v_perfil      public.perfiles;
  v_item        jsonb;
  v_sugerencia  text;
  v_sug_id      uuid;
  v_n_sugeridos integer := 0;
  v_pendientes  integer;
begin
  if v_uid is null then raise exception 'Debes iniciar sesión'; end if;

  select * into v_perfil from public.perfiles p where p.id = v_uid;
  if not found then
    raise exception 'Necesitas completar tu perfil';
  end if;

  -- `responder_solicitud` ya comprobaba esto y aquí faltaba: una cuenta
  -- suspendida por publicar datos personales conservaba intacto este canal
  -- de escritura de texto libre.
  if v_perfil.suspendido then
    raise exception 'Tu perfil está suspendido';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Formato de inventario inválido';
  end if;

  if jsonb_array_length(p_items) > 100 then
    raise exception 'Son demasiados ítems de una sola vez';
  end if;

  -- El tope de 3 es por llamada, así que sin este de aquí una cuenta puede
  -- llamar en bucle y llenar la cola de moderación. `sugerencias_pendientes`
  -- recorre el catálogo por cada palabra de cada sugerencia pendiente: con
  -- unos miles de filas, /admin deja de cargar, y /admin es la única
  -- herramienta de moderación que tiene el proyecto.
  select count(*) into v_pendientes
    from public.sugerencias_item sg
   where sg.propuesta_por = v_uid and sg.estado = 'pendiente';

  delete from public.ofrecimientos where perfil_id = v_uid;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_sugerencia := nullif(trim(v_item->>'sugerencia'), '');
    v_sug_id     := nullif(v_item->>'sugerencia_id', '')::uuid;

    if v_sugerencia is not null then
      v_n_sugeridos := v_n_sugeridos + 1;
      if v_n_sugeridos > 3 then
        raise exception 'Puedes sugerir máximo 3 cosas nuevas a la vez';
      end if;
      if v_pendientes + v_n_sugeridos > 10 then
        raise exception 'Ya tienes muchas sugerencias esperando revisión. Espera a que las revisen.';
      end if;

      if char_length(v_sugerencia) < 2 or char_length(v_sugerencia) > 60 then
        raise exception 'El nombre de lo que sugieres debe tener entre 2 y 60 caracteres';
      end if;

      if public.contiene_pii(v_sugerencia) then
        raise exception 'El nombre de lo que sugieres no puede contener teléfonos ni correos';
      end if;

      insert into public.sugerencias_item (nombre_propuesto, propuesta_por, origen, es_prueba)
      values (v_sugerencia, v_uid, 'ofertador', v_perfil.nombre_visible ilike 'prueba%')
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
create or replace function public.responder_solicitud(
  p_codigo       text,
  p_mensaje      text,
  p_puede_llevar boolean default false
)
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

  -- Sin contacto publico no hay respuesta posible: el flujo directo se
  -- sostiene sobre que quien pidio pueda escribirle a quien ofrecio. Un
  -- perfil de aliado no tiene contacto, y por eso no responde por aqui —
  -- para el flujo acompanado existe iniciar_conversacion.
  if not exists (select 1 from public.perfiles p
                  where p.id = v_uid and p.contacto_publico is not null) then
    raise exception 'Para responder necesitas una forma de contacto en tu perfil: si no, quien pidio ayuda no tiene a donde escribirte';
  end if;

  select s.id into v_solicitud_id
    from public.solicitudes s
   where s.codigo = upper(trim(p_codigo))
     and public.estado_activo(s.estado)
     and s.expira_at > now();

  if v_solicitud_id is null then
    raise exception 'Esa solicitud ya no está disponible';
  end if;

  if exists (select 1 from public.respuestas r
              where r.solicitud_id = v_solicitud_id and r.autor_id = v_uid) then
    raise exception 'Ya respondiste esta solicitud';
  end if;

  insert into public.respuestas (solicitud_id, autor_id, mensaje, puede_llevar)
  values (v_solicitud_id, v_uid, trim(p_mensaje), coalesce(p_puede_llevar, false));

  return v_solicitud_id;
end;
$$;

revoke execute on function public.responder_solicitud(text,text,boolean) from public, anon;
grant  execute on function public.responder_solicitud(text,text,boolean) to authenticated;

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
  if p_tipo_objeto not in ('solicitud','respuesta','perfil','entidad') then
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
-- `resolver_reporte` se define UNA sola vez, en el bloque de la Fase I:
-- allá deja de borrar a ciegas. Ver la migración v2-i1.

-- ---------------------------------------------------------------------
-- 4. Alta y edición
-- ---------------------------------------------------------------------

create or replace function public.guardar_entidad(
  p_id          uuid,                          -- null = crear
  p_nombre      text,
  p_subtitulo   text    default null,
  p_descripcion text    default null,
  p_enlaces     jsonb   default '[]'::jsonb,
  p_pie         text    default null,
  p_cobertura   text    default 'nacional',
  p_municipios  text[]  default '{}',
  p_orden       integer default 0
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
  v_mun text[];
begin
  if not public.es_admin(v_uid) then
    raise exception 'No autorizado';
  end if;

  if char_length(trim(coalesce(p_nombre, ''))) not between 3 and 80 then
    raise exception 'El nombre debe tener entre 3 y 80 caracteres';
  end if;

  if p_cobertura not in ('nacional','local') then
    raise exception 'La cobertura debe ser nacional o local';
  end if;

  if p_cobertura = 'local' and coalesce(array_length(p_municipios, 1), 0) = 0 then
    raise exception 'Una entidad local necesita al menos un municipio';
  end if;

  if p_cobertura = 'local' and exists (
       select 1 from unnest(p_municipios) m
        where m not in (select mu.codigo_dane from public.municipios mu)) then
    raise exception 'Hay un municipio que no existe';
  end if;

  -- El mismo control que el CHECK, aquí para que salga un mensaje legible
  -- y no un error crudo de Postgres.
  if not public.enlaces_validos(coalesce(p_enlaces, '[]'::jsonb)) then
    raise exception 'Cada enlace necesita un texto de 2 a 40 caracteres y una dirección que empiece por https://, sin espacios y sin arroba. Máximo 6 enlaces.';
  end if;

  v_mun := case when p_cobertura = 'local' then p_municipios else '{}'::text[] end;

  if p_id is null then
    insert into public.entidades
      (nombre, subtitulo, descripcion, enlaces, pie,
       cobertura, municipios, orden, creada_por, es_prueba)
    values
      (trim(p_nombre),
       nullif(trim(p_subtitulo), ''),
       nullif(trim(p_descripcion), ''),
       coalesce(p_enlaces, '[]'::jsonb),
       nullif(trim(p_pie), ''),
       p_cobertura, v_mun, coalesce(p_orden, 0), v_uid,
       trim(p_nombre) ilike 'prueba%')
    returning id into v_id;
  else
    update public.entidades
       set nombre         = trim(p_nombre),
           subtitulo      = nullif(trim(p_subtitulo), ''),
           descripcion    = nullif(trim(p_descripcion), ''),
           enlaces        = coalesce(p_enlaces, '[]'::jsonb),
           pie            = nullif(trim(p_pie), ''),
           cobertura      = p_cobertura,
           municipios     = v_mun,
           orden          = coalesce(p_orden, 0),
           -- Se RECALCULA, no se conserva. La marca tiene que seguir
           -- diciendo lo que se ve en pantalla: si alguien renombra
           -- «PRUEBA Fundación X» a «Fundación X», dejó de ser de prueba, y
           -- conservarla haría que la limpieza borrara una ficha real.
           es_prueba      = trim(p_nombre) ilike 'prueba%',
           actualizada_at = now()
     where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Esa entidad no existe';
    end if;
  end if;

  return v_id;
end;
$$;

revoke execute on function public.guardar_entidad(uuid,text,text,text,jsonb,text,text,text[],integer) from public, anon;
grant  execute on function public.guardar_entidad(uuid,text,text,text,jsonb,text,text,text[],integer) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Bajar, subir y borrar
--
-- `activar_entidad` va aparte y no dentro de `guardar_entidad`: retirar
-- una ficha tiene que ser un clic desde la lista, sin reenviar el
-- formulario y sin que uno a medio llenar blanquee la fila. Misma forma
-- que `suspender_perfil` y `verificar_servidor`.
-- ---------------------------------------------------------------------

create or replace function public.activar_entidad(p_id uuid, p_activa boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;
  update public.entidades
     set activa = p_activa, actualizada_at = now()
   where id = p_id;
end;
$$;

revoke execute on function public.activar_entidad(uuid,boolean) from public, anon;
grant  execute on function public.activar_entidad(uuid,boolean) to authenticated;

create or replace function public.borrar_entidad(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;
  delete from public.entidades where id = p_id;
end;
$$;

revoke execute on function public.borrar_entidad(uuid) from public, anon;
grant  execute on function public.borrar_entidad(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- Organizaciones aliadas (Flujo 2). Ver migración v2-d1 para el porqué de
-- cada decisión; aquí va solo el estado final.
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
           -- Se RECALCULA, igual que en `guardar_entidad`.
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

-- Suspender. No borra: `es_miembro_activo()` pasa a devolver falso para
-- todo su equipo, que es lo que hace falta.
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

-- Lo que ve el panel de administración. Por RPC y no por `select` con
-- política, como `sugerencias_pendientes`: así `creada_por` no sale nunca
-- hacia el navegador.
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

-- Un admin solo genera la invitación de COORDINADOR: es el acto de
-- entregarle la organización a la fundación, no el de meterle gente. De
-- ahí en adelante el equipo lo arma el coordinador.
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

  -- Techos duros: un enlace de un año con usos ilimitados es una puerta
  -- abierta con la llave puesta.
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

-- Lo único que se puede saber de una organización sin estar dentro: su
-- nombre. Ni municipios, ni acopio, ni cuánta gente hay. Es la única de
-- este bloque con EXECUTE para `anon`, porque la pantalla de /unirse tiene
-- que decir a qué se está entrando antes de pedir la sesión de Google.
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
-- ser un cartel viejo en la pared, no un ataque.
--
-- Crea el perfil si no existe. Si ya existe, no le toca el tipo: un
-- ofertador que además coordina en una fundación sigue siendo ofertador en
-- su ficha pública.
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
  -- Separada del registro: dice si hay que gastarle un uso a la
  -- invitación, y hay un camino —ya era miembro— donde no se gasta.
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
    -- Estaba en la cola y volvió con un código bueno: se le abre.
    update public.miembros_organizacion
       set rol           = v_rol,
           estado        = 'activo',
           invitacion_id = v_inv_id,
           aprobado_por  = v_uid,
           aprobado_at   = now()
     where organizacion_id = v_org.id and perfil_id = v_uid;

  else
    -- Ya era miembro activo o lo desactivaron. Un código no revive a quien
    -- un coordinador sacó, y no se gasta un uso por reabrir el enlace.
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

-- Toda la pantalla de /aliado en una sola RPC, como `sugerencias_pendientes`.
-- El equipo y las invitaciones solo salen para un coordinador activo: un
-- miembro raso no ve quién más está dentro, y uno pendiente no ve nada.
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

-- Lo que hace un coordinador con su equipo. Una sola RPC con una acción,
-- como `resolver_sugerencia`. Lo que NO entra aquí es
-- `puede_ver_identidad`: tiene función propia, y es a propósito.
--
-- Nadie se aplica una acción a sí mismo: es lo que evita que el único
-- coordinador se degrade solo y deje la organización muda.
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
    -- Borrado duro (regla 4). Quien fue rechazado puede volver a intentarlo
    -- con un código bueno; no queda un renglón de «le dijeron que no».
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

-- Los dos permisos, y solo por aquí. `puede_ver_identidad` es lo que deja
-- ver cédulas: nunca se otorga solo —ni al entrar por enlace, ni al ser
-- aprobado, ni al ser coordinador—, siempre como acto explícito de alguien
-- sobre alguien, y registrado.
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

  -- Solo a gente activa: darle el permiso de ver cédulas a alguien que
  -- sigue en la cola de aprobación no tiene ninguna lectura buena.
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
-- Identidad cifrada (Fase E). Ver migración v2-e1 para el porqué de cada
-- decisión; aquí va solo el estado final.
--
-- `crear_identidad` no descifra y no escribe bitácora: guardar no es leer.
-- La llama el servidor con la llave de servicio, como
-- `destinatarios_aviso` — por eso no lleva grant a `authenticated`.
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

-- HOY: solo un administrador.
--
-- El camino del aliado necesita saber a QUÉ organización pertenece la
-- identidad, y esa columna —`solicitudes.organizacion_id`— llega en la
-- Fase F. Mientras no exista, conceder por «es aliado con permiso en
-- alguna organización» dejaría que cualquier fundación leyera las cédulas
-- de las demás, que es lo que la regla K existe para impedir.
--
-- Cuando llegue la Fase F, esta es la única función que hay que tocar.
create or replace function public.puede_leer_identidad(p_identidad_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select
    (public.es_admin(auth.uid())
       and exists (select 1 from public.identidades i where i.id = p_identidad_id))
    -- Cuatro condiciones, todas: miembro activo, con permiso, de la
    -- organización que acompaña ESA solicitud, y con la organización
    -- activa. Las identidades que cuelgan de un perfil —ofertadores y
    -- aliados— siguen siendo solo del administrador: quién puede verlas
    -- depende de la conversación en la que aparezcan, y eso es de la
    -- Fase G.
    or exists (
      select 1
        from public.identidades i
        join public.solicitudes s          on s.id = i.solicitud_id
        join public.miembros_organizacion m on m.organizacion_id = s.organizacion_id
        join public.organizaciones o        on o.id = m.organizacion_id
       where i.id = p_identidad_id
         and s.flujo             = 'acompanado'
         and m.perfil_id         = auth.uid()
         and m.estado            = 'activo'
         and m.puede_ver_identidad
         and o.activa);
$$;

revoke execute on function public.puede_leer_identidad(uuid) from public, anon, authenticated;

-- La bitácora se escribe siempre por aquí, y con las copias de texto
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

-- Alguien llega al punto de acopio y perdió el enlace de su solicitud
-- (F10). Dice su cédula, y esto la hashea con el pepper y busca. NO
-- descifra nada. Deja rastro incluso cuando no encuentra: una búsqueda a
-- ciegas contra veinte cédulas también es un acceso.
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

-- ---------------------------------------------------------------------
-- Elección de flujo (Fase F). Ver migración v2-f1.
--
-- `aliados_del_municipio` devuelve TODAS las organizaciones activas que
-- cubren ese municipio, con su dirección de acopio y su horario.
--
-- Antes devolvía una sola y sin dirección, con el argumento de que un
-- desplegable de fundaciones convertía una oferta en una decisión de
-- compras. El argumento no sobrevivió al uso: sin saber dónde queda cada
-- acopio no se puede escoger la que quede más fácil, y esa es justo la
-- decisión que importa cuando hay que ir a recoger algo a pie.
--
-- Publicar la dirección de acopio a `anon` es deliberado: es la dirección
-- de una ORGANIZACIÓN, no de una persona.
-- ---------------------------------------------------------------------

create or replace function public.aliados_del_municipio(p_municipio text)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',               o.id,
           'nombre',           o.nombre,
           'direccion_acopio', o.direccion_acopio,
           'horario_acopio',   o.horario_acopio
         ) order by o.nombre), '[]'::jsonb)
    from public.organizaciones o
   where o.activa and p_municipio = any(o.municipios);
$$;

grant execute on function public.aliados_del_municipio(text) to anon, authenticated;

-- Una sola transacción: crea la identidad cifrada y marca la solicitud. Si
-- el cifrado falla —por ejemplo porque falta el secreto del Vault—, no
-- queda una solicitud acompañada sin identidad: no queda nada.
--
-- La autoriza el token portador, que es lo único que tiene quien pidió
-- ayuda. NO existe el camino de vuelta: quien se arrepienta borra y
-- republica, que además es su derecho de supresión (§7).
create or replace function public.activar_acompanamiento(
  p_token                text,
  p_organizacion_id      uuid,
  p_nombre               text,
  p_documento_tipo       text,
  p_documento            text,
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
    'solicitante', p_nombre, p_documento_tipo, p_documento,
    p_autorizacion_version, p_telefono, v_sol.id, null);

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

grant execute on function public.activar_acompanamiento(text,uuid,text,text,text,text,text)
  to anon, authenticated;

-- ---------------------------------------------------------------------
-- Chat tripartito (Fase G). Ver migración v2-g1.
--
-- La lectura va del navegador a estas RPC cada 30 segundos y solo con la
-- conversación a la vista. No es Realtime a propósito: `postgres_changes`
-- respeta RLS, estas tablas están revocadas enteras, y uno de los tres
-- participantes es anónimo con token, así que no hay `auth.uid()` con el
-- que autorizarlo. Y el sondeo no cuesta invocaciones de Vercel porque no
-- pasa por Vercel.
-- ---------------------------------------------------------------------

create or replace function public.iniciar_conversacion(p_codigo text, p_mensaje text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_sol  public.solicitudes;
  v_org  public.organizaciones;
  v_conv uuid;
  v_estado text;
begin
  if v_uid is null then
    raise exception 'Debes iniciar sesión';
  end if;

  if not exists (select 1 from public.perfiles p
                  where p.id = v_uid and p.suspendido = false) then
    raise exception 'Necesitas completar tu perfil antes de escribir';
  end if;

  if char_length(trim(p_mensaje)) < 10 or char_length(p_mensaje) > 1000 then
    raise exception 'El mensaje debe tener entre 10 y 1000 caracteres';
  end if;

  if public.contiene_contacto(p_mensaje) then
    raise exception 'No escribas teléfonos, correos ni enlaces de mensajería: la coordinación ocurre aquí';
  end if;

  select * into v_sol from public.solicitudes s
   where s.codigo = upper(trim(p_codigo))
     and public.estado_activo(s.estado)
     and s.expira_at > now();

  if v_sol.id is null then
    raise exception 'Esa solicitud ya no está disponible';
  end if;

  -- El hilo tripartito existe solo para el Flujo 2. En el Flujo 1 la
  -- plataforma no se mete en la conversación, y eso es la regla 3.
  if v_sol.flujo <> 'acompanado' then
    raise exception 'Esa solicitud no tiene acompañamiento: respóndela como siempre';
  end if;

  select * into v_org from public.organizaciones o
   where o.id = v_sol.organizacion_id and o.activa;

  -- Fallback de §8-F5: si la fundación se desactivó entre medias, el hilo
  -- nace esperando y no se pierde.
  v_estado := case when v_org.id is null then 'esperando_aliado' else 'asignada' end;

  insert into public.conversaciones (solicitud_id, ofertador_id, organizacion_id, estado)
  values (v_sol.id, v_uid, v_org.id, v_estado)
  on conflict (solicitud_id, ofertador_id) do nothing
  returning id into v_conv;

  if v_conv is null then
    raise exception 'Ya tienes una conversación abierta sobre esta solicitud';
  end if;

  -- La excepción de la regla L, acotada a esta transacción.
  perform set_config('aquive.mensaje_inicial', 'on', true);

  insert into public.mensajes (conversacion_id, autor_rol, autor_perfil_id, cuerpo)
  values (v_conv, 'ofertador', v_uid, trim(p_mensaje));

  perform set_config('aquive.mensaje_inicial', 'off', true);

  return v_conv;
end;
$$;

revoke execute on function public.iniciar_conversacion(text,text) from public, anon;
grant  execute on function public.iniciar_conversacion(text,text) to authenticated;

-- `asignada` → `abierta`. Aquí el hilo empieza a aceptar mensajes, y la
-- solicitud pasa a `en_coordinacion`: no cuando alguien escribe, sino
-- cuando hay una persona concreta respondiendo por ella.
create or replace function public.asignar_aliado(p_conversacion_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_conv public.conversaciones;
begin
  select * into v_conv from public.conversaciones c where c.id = p_conversacion_id;

  if v_conv.id is null then
    raise exception 'Esa conversación no existe';
  end if;

  if not public.es_miembro_activo(v_conv.organizacion_id, v_uid) then
    raise exception 'No autorizado';
  end if;

  if v_conv.estado not in ('asignada','esperando_aliado') then
    raise exception 'Esa conversación ya tiene a alguien a cargo';
  end if;

  update public.conversaciones
     set aliado_id = v_uid, estado = 'abierta'
   where id = p_conversacion_id;

  update public.solicitudes
     set estado = 'en_coordinacion'
   where id = v_conv.solicitud_id
     and estado = 'abierta';
end;
$$;

revoke execute on function public.asignar_aliado(uuid) from public, anon;
grant  execute on function public.asignar_aliado(uuid) to authenticated;

-- Dos puertas para escribir porque hay dos formas de ser alguien aquí:
-- una sesión, o el token de la solicitud. La validación es la misma.
create or replace function public.enviar_mensaje(p_conversacion_id uuid, p_cuerpo text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rol text := public.rol_en_conversacion(p_conversacion_id);
  v_id  uuid;
begin
  if v_rol is null then
    raise exception 'No autorizado';
  end if;

  if char_length(trim(p_cuerpo)) < 1 or char_length(p_cuerpo) > 1000 then
    raise exception 'El mensaje debe tener entre 1 y 1000 caracteres';
  end if;

  if public.contiene_contacto(p_cuerpo) then
    raise exception 'No escribas teléfonos, correos ni enlaces de mensajería: la coordinación ocurre aquí';
  end if;

  insert into public.mensajes (conversacion_id, autor_rol, autor_perfil_id, cuerpo)
  values (p_conversacion_id, v_rol, auth.uid(), trim(p_cuerpo))
  returning id into v_id;

  return v_id;
end;
$$;

revoke execute on function public.enviar_mensaje(uuid,text) from public, anon;
grant  execute on function public.enviar_mensaje(uuid,text) to authenticated;

create or replace function public.enviar_mensaje_token(
  p_token text,
  p_conversacion_id uuid,
  p_cuerpo text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  -- El token no autoriza «cualquier conversación»: solo las de SU
  -- solicitud. Sin esta comprobación, quien tenga un token cualquiera
  -- podría escribir en el hilo de otra persona.
  if not exists (
    select 1 from public.conversaciones c
      join public.solicitudes s on s.id = c.solicitud_id
     where c.id = p_conversacion_id
       and s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  ) then
    raise exception 'No autorizado';
  end if;

  if char_length(trim(p_cuerpo)) < 1 or char_length(p_cuerpo) > 1000 then
    raise exception 'El mensaje debe tener entre 1 y 1000 caracteres';
  end if;

  if public.contiene_contacto(p_cuerpo) then
    raise exception 'No escribas tu teléfono ni tu correo: la coordinación ocurre aquí, y así queda constancia';
  end if;

  insert into public.mensajes (conversacion_id, autor_rol, autor_perfil_id, cuerpo)
  values (p_conversacion_id, 'solicitante', null, trim(p_cuerpo))
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.enviar_mensaje_token(text,uuid,text) to anon, authenticated;

-- `leer_conversacion` se define UNA sola vez, en el bloque de la Fase H:
-- allá gana los ítems pendientes que necesita la pantalla de la entrega.

-- Los mensajes de un hilo, SIN comprobar permisos: los comprueban las
-- tres funciones que la llaman. Por eso queda revocada para todos.
create or replace function public.mensajes_de(p_conversacion_id uuid)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',        m.id,
           'rol',       m.autor_rol,
           'nombre',    p.nombre_visible,
           'cuerpo',    case when m.oculto then null else m.cuerpo end,
           'oculto',    m.oculto,
           'creado_at', m.creado_at
         ) order by m.creado_at), '[]'::jsonb)
    from public.mensajes m
    left join public.perfiles p on p.id = m.autor_perfil_id
   where m.conversacion_id = p_conversacion_id;
$$;

revoke execute on function public.mensajes_de(uuid) from public, anon, authenticated;

-- Lo que ve quien pidió ayuda: todos los hilos de SU solicitud.
create or replace function public.mis_conversaciones_token(p_token text)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',       c.id,
           'estado',   c.estado,
           'directa',  c.directa,
           'ofertador', (select p.nombre_visible from public.perfiles p
                          where p.id = c.ofertador_id),
           'aliado',    (select p.nombre_visible from public.perfiles p
                          where p.id = c.aliado_id),
           'acopio',   (select jsonb_build_object('nombre', o.nombre,
                                 'direccion', o.direccion_acopio,
                                 'horario', o.horario_acopio)
                          from public.organizaciones o where o.id = c.organizacion_id),
           'mensajes', public.mensajes_de(c.id)
         ) order by c.creada_at), '[]'::jsonb)
    from public.conversaciones c
    join public.solicitudes s on s.id = c.solicitud_id
   where s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

grant execute on function public.mis_conversaciones_token(text) to anon, authenticated;

-- Lo que ve una cuenta: los hilos donde ofrece, y los de las
-- organizaciones donde es miembro activo.
create or replace function public.mis_hilos()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x->>'creada_at' desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'id',            c.id,
        'estado',        c.estado,
        'creada_at',     c.creada_at,
        'codigo',        s.codigo,
        'municipio',     m.nombre || ', ' || m.departamento,
        'barrio',        s.barrio,
        'directa',       c.directa,
        -- `coalesce` y no la comparación pelada: en un hilo directo
        -- `ofertador_id` es nulo, y `null = uuid` da NULL, no false. Sin
        -- esto el campo llega como null al navegador.
        'soy_ofertador', coalesce(c.ofertador_id = auth.uid(), false),
        'ofertador',     (select p.nombre_visible from public.perfiles p where p.id = c.ofertador_id),
        'aliado',        (select p.nombre_visible from public.perfiles p where p.id = c.aliado_id),
        'sin_asignar',   c.aliado_id is null,
        'mensajes_total',(select count(*) from public.mensajes mm where mm.conversacion_id = c.id)
      ) as x
      from public.conversaciones c
      join public.solicitudes s on s.id = c.solicitud_id
      join public.municipios m  on m.codigo_dane = s.municipio
     where c.ofertador_id = auth.uid()
        or public.es_miembro_activo(c.organizacion_id, auth.uid())
    ) t;
$$;

revoke execute on function public.mis_hilos() from public, anon;
grant  execute on function public.mis_hilos() to authenticated;

-- ---------------------------------------------------------------------
-- La fundación entrega de su propia bodega. Ver migración v2-j2.
--
-- Faltaba un caso entero: una fundación que YA TIENE lo que alguien pidió
-- tenía que esperar a un ofertador, porque toda entrega colgaba de una
-- conversación con uno.
--
-- Sobre la regla L: este hilo NO la viola. La regla dice que un hilo sin
-- aliado a cargo no acepta mensajes, y este nace con `aliado_id` puesto en
-- el mismo INSERT. Y de fondo: lo que la regla impide es el aparte entre
-- dos desconocidos sin un tercero responsable; aquí las dos partes son
-- quien pidió y la organización que él mismo eligió. Hay una persona menos
-- viendo el hilo, no una más.
--
-- `exigir_hilo_con_aliado` NO se toca.
-- ---------------------------------------------------------------------

create or replace function public.abrir_entrega_directa(
  p_solicitud_id uuid,
  p_mensaje      text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_sol  public.solicitudes;
  v_conv uuid;
begin
  select * into v_sol from public.solicitudes s
   where s.id = p_solicitud_id
     and public.estado_activo(s.estado)
     and s.expira_at > now();

  if v_sol.id is null then
    raise exception 'Esa solicitud ya no está disponible';
  end if;

  -- Innegociable, y por la misma razón que en `coincidencias_para_aliado`:
  -- sin esto la fundación podría abrirle un hilo a alguien del Flujo 1, que
  -- nunca aceptó nada. Sería la regla R rota por la puerta de atrás.
  if v_sol.flujo <> 'acompanado' then
    raise exception 'Esa solicitud no tiene acompañamiento';
  end if;

  if not public.es_miembro_activo(v_sol.organizacion_id, v_uid) then
    raise exception 'No autorizado';
  end if;

  if char_length(trim(p_mensaje)) < 10 or char_length(p_mensaje) > 1000 then
    raise exception 'El mensaje debe tener entre 10 y 1000 caracteres';
  end if;

  -- Regla M, igual que en cualquier otro hilo. No se relaja porque quien
  -- escribe sea la fundación.
  if public.contiene_contacto(p_mensaje) then
    raise exception 'No escribas teléfonos, correos ni enlaces de mensajería';
  end if;

  insert into public.conversaciones
    (solicitud_id, ofertador_id, aliado_id, organizacion_id, estado, directa)
  values
    (v_sol.id, null, v_uid, v_sol.organizacion_id, 'abierta', true)
  on conflict (solicitud_id) where directa do nothing
  returning id into v_conv;

  if v_conv is null then
    raise exception 'Ya abriste una conversación de entrega para esta solicitud';
  end if;

  -- Sin `aquive.mensaje_inicial`: el hilo ya nace `abierta` y el trigger lo
  -- deja pasar. Esa excepción solo hace falta cuando nace `asignada`.
  insert into public.mensajes (conversacion_id, autor_rol, autor_perfil_id, cuerpo)
  values (v_conv, 'aliado', v_uid, trim(p_mensaje));

  update public.solicitudes set estado = 'en_coordinacion'
   where id = v_sol.id and estado = 'abierta';

  return v_conv;
end;
$$;

revoke execute on function public.abrir_entrega_directa(uuid,text) from public, anon;
grant  execute on function public.abrir_entrega_directa(uuid,text) to authenticated;

-- Qué puede atender la fundación por su cuenta.
--
-- Sin `v_cruces` y sin `ofrecimientos`: no hay inventario de
-- organizaciones y no se va a inventar uno —uno que alguien tiene que
-- mantener al día es un cruce que miente en cuanto se descuida—. Esto es
-- lo que su organización acompaña y todavía no ha atendido; la fundación
-- mira los ítems y decide.
--
-- Cero PII: el nombre de quien pidió sigue saliendo solo por
-- `exportar_planilla`, con motivo y rastro en `accesos_identidad`.
create or replace function public.solicitudes_de_mi_organizacion()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x->>'creada_at'), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'solicitud_id',  s.id,
        'codigo',        s.codigo,
        'municipio',     m.nombre || ', ' || m.departamento,
        'barrio',        s.barrio,
        'categoria',     s.categoria,
        'nota',          s.nota,
        'creada_at',     s.creada_at,
        'puede_recoger', s.puede_recoger,
        -- Cuántos hilos vivos tiene ya: si alguien más está trayendo esto,
        -- la fundación decide distinto.
        'hilos',         (select count(*) from public.conversaciones c
                           where c.solicitud_id = s.id and c.estado <> 'cerrada'),
        'pendientes',    (select coalesce(jsonb_agg(jsonb_build_object(
                                  'nombre',   coalesce(ci.nombre, sg.nombre_propuesto),
                                  'cantidad', si.cantidad,
                                  'unidad',   coalesce(ci.unidad, sg.unidad_sugerida, 'unidad')
                                ) order by coalesce(ci.orden, 9999)), '[]'::jsonb)
                            from public.solicitud_items si
                            left join public.catalogo_items ci   on ci.id = si.item_id
                            left join public.sugerencias_item sg on sg.id = si.sugerencia_id
                           where si.solicitud_id = s.id and si.cubierto = false)
      ) as x
      from public.solicitudes s
      join public.municipios m on m.codigo_dane = s.municipio
     where s.flujo = 'acompanado'
       and public.estado_activo(s.estado)
       and s.expira_at > now()
       and public.es_miembro_activo(s.organizacion_id, auth.uid())
       and exists (select 1 from public.solicitud_items si
                    where si.solicitud_id = s.id and si.cubierto = false)
       and not exists (select 1 from public.conversaciones c
                        where c.solicitud_id = s.id and c.directa)
    ) t;
$$;

revoke execute on function public.solicitudes_de_mi_organizacion() from public, anon;
grant  execute on function public.solicitudes_de_mi_organizacion() to authenticated;

create or replace function public.admin_anotar_solicitud(
  p_codigo text,
  p_nota   text,
  p_cerrar boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_nota text := nullif(trim(coalesce(p_nota, '')), '');
  v_sol  public.solicitudes;
begin
  if not public.es_admin(v_uid) then
    raise exception 'No autorizado';
  end if;

  if v_nota is not null then
    if char_length(v_nota) > 200 then
      raise exception 'La nota no puede pasar de 200 caracteres';
    end if;
    -- Mismo filtro que la nota de quien pide. Aquí escribe el responsable
    -- del proyecto, sí, pero sobre la entrega a una persona concreta: es
    -- justo donde uno escribiría «se lo llevaron a María, calle 5».
    if public.contiene_pii(v_nota) then
      raise exception 'La nota no puede llevar teléfonos, correos ni documentos. Di qué pasó, no de quién.';
    end if;
  end if;

  if p_cerrar and v_nota is null then
    raise exception 'Para cerrar una solicitud ajena hay que decir por qué';
  end if;

  select * into v_sol from public.solicitudes s
   where s.codigo = upper(trim(p_codigo));

  if v_sol.id is null then
    raise exception 'Esa solicitud no existe o ya se borró';
  end if;

  update public.solicitudes
     set nota_admin     = v_nota,
         nota_admin_at  = case when v_nota is null then null else now() end,
         nota_admin_por = case when v_nota is null then null else v_uid end,
         -- `cumplida` y nunca un borrado: ver la cabecera.
         estado         = case when p_cerrar then 'cumplida' else estado end
   where id = v_sol.id;

  return jsonb_build_object(
    'codigo', v_sol.codigo,
    'cerrada', p_cerrar
  );
end;
$$;

revoke execute on function public.admin_anotar_solicitud(text,text,boolean) from public, anon;
grant  execute on function public.admin_anotar_solicitud(text,text,boolean) to authenticated;

create or replace function public.solicitudes_admin()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select case when not public.es_admin(auth.uid()) then '[]'::jsonb
         else coalesce((
           select jsonb_agg(jsonb_build_object(
             'codigo',      s.codigo,
             'municipio',   m.nombre || ', ' || m.departamento,
             'barrio',      s.barrio,
             'categoria',   s.categoria,
             'nota',        s.nota,
             'nota_admin',  s.nota_admin,
             'estado',      s.estado,
             'creada_at',   s.creada_at,
             'expira_at',   s.expira_at,
             'respuestas',  (select count(*) from public.respuestas r where r.solicitud_id = s.id),
             'items',       (select coalesce(jsonb_agg(jsonb_build_object(
                                      'nombre',   coalesce(ci.nombre, sg.nombre_propuesto),
                                      'cantidad', si.cantidad,
                                      'unidad',   coalesce(ci.unidad, sg.unidad_sugerida, 'unidad'))
                                    order by coalesce(ci.orden, 9999)), '[]'::jsonb)
                               from public.solicitud_items si
                               left join public.catalogo_items ci   on ci.id = si.item_id
                               left join public.sugerencias_item sg on sg.id = si.sugerencia_id
                              where si.solicitud_id = s.id),
             'contacto',    (select jsonb_build_object(
                                      'nombre', sc.nombre, 'telefono', sc.telefono, 'correo', sc.correo)
                               from public.solicitudes_contacto sc
                              where sc.solicitud_id = s.id)
           ) order by s.creada_at desc)
             from public.solicitudes s
             join public.municipios m on m.codigo_dane = s.municipio
         ), '[]'::jsonb)
         end;
$$;

revoke execute on function public.solicitudes_admin() from public, anon;
grant  execute on function public.solicitudes_admin() to authenticated;

-- Moderar oculta, no borra: si un mensaje hay que atenderlo, la evidencia
-- de que existió tiene que quedar hasta que muera el hilo.
create or replace function public.moderar_mensaje(p_mensaje_id uuid, p_oculto boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_org uuid;
begin
  select c.organizacion_id into v_org
    from public.mensajes m
    join public.conversaciones c on c.id = m.conversacion_id
   where m.id = p_mensaje_id;

  if v_org is null and not public.es_admin(v_uid) then
    raise exception 'Ese mensaje no existe';
  end if;

  -- El administrador siempre; el aliado solo si su coordinador le dio el
  -- permiso de moderar, y solo en los hilos de su organización.
  if not (public.es_admin(v_uid)
          or exists (select 1 from public.miembros_organizacion mo
                      where mo.organizacion_id = v_org
                        and mo.perfil_id = v_uid
                        and mo.estado = 'activo'
                        and mo.puede_moderar)) then
    raise exception 'No autorizado';
  end if;

  update public.mensajes
     set oculto = p_oculto,
         oculto_por = case when p_oculto then v_uid end,
         oculto_at  = case when p_oculto then now() end
   where id = p_mensaje_id;
end;
$$;

revoke execute on function public.moderar_mensaje(uuid,boolean) from public, anon;
grant  execute on function public.moderar_mensaje(uuid,boolean) to authenticated;

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

  -- Antes lo atrapaba el CHECK de la tabla y al administrador le salía en
  -- pantalla un error crudo de Postgres.
  if p_categoria not in ('alimentacion','aseo','salud','abrigo','cocina','otros','servicios','mascotas') then
    raise exception 'Categoría inválida';
  end if;

  if public.contiene_pii(p_nombre) then
    raise exception 'El nombre no puede contener teléfonos ni correos';
  end if;

  v_id := public.slug_item(p_nombre);

  insert into public.catalogo_items (id, categoria, nombre, unidad, orden, creado_por, origen, es_prueba)
  values (v_id, p_categoria, trim(p_nombre),
          coalesce(nullif(trim(p_unidad), ''), 'unidad'), 9999, v_uid, 'admin',
          trim(p_nombre) ilike 'prueba%');

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
  p_accion        text,
  p_item_destino  text default null,
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

    -- Sin esto, el inventario que la referenciaba queda "por confirmar"
    -- para siempre: nadie lo va a resolver nunca. El inventario se puede
    -- volver a llenar; la solicitud no se toca, porque su necesidad es real
    -- y de todos modos se borra sola en menos de 72 horas.
    delete from public.ofrecimientos where sugerencia_id = p_sugerencia_id;
    return null;
  end if;

  if p_accion = 'aprobar' then
    -- Aprobar copia este texto a `catalogo_items`, que es de lectura
    -- pública y permanente, y no hay ninguna RPC para borrar de ahí. Un
    -- clic distraído sobre una sugerencia con un teléfono lo publicaría
    -- para siempre.
    if public.contiene_pii(v_sug.nombre_propuesto) then
      raise exception 'Esa sugerencia trae un teléfono o un correo: recházala, no la apruebes';
    end if;

    v_destino := public.slug_item(v_sug.nombre_propuesto);
    insert into public.catalogo_items (id, categoria, nombre, unidad, orden, creado_por, origen, es_prueba)
    values (v_destino,
            coalesce(v_sug.categoria_sugerida, 'otros'),
            trim(v_sug.nombre_propuesto),
            coalesce(nullif(trim(v_sug.unidad_sugerida), ''), 'unidad'),
            9999, v_uid, 'sugerencia', v_sug.es_prueba);
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

-- `expirar_solicitudes` se define UNA sola vez, en el bloque de la Fase I:
-- allá deja de borrar a ciegas. Ver la migración v2-i1.
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

-- =====================================================================
-- Coincidencias y entregas (Fase H). Ver migración v2-h1 para el porqué
-- de cada decisión; aquí va el estado final.
-- =====================================================================

alter table public.solicitud_items
  add column if not exists cubierto_at timestamptz;
alter table public.solicitud_items
  add column if not exists cubierto_por text
    check (cubierto_por is null or cubierto_por in ('solicitante','aliado','entrega'));

-- ---------------------------------------------------------------------
-- 2. `entregas` — lo que queda cuando ya no queda nada
--
-- ⚠ SIN llave foránea a la solicitud, a propósito. La solicitud se borra a
-- las 72 horas y esta fila tiene que sobrevivirla: por eso el código va
-- como TEXTO copiado, no como referencia, y `conversacion_id` va en ON
-- DELETE SET NULL. Mismo razonamiento que `accesos_identidad`.
--
-- Aquí no hay PII: ítems, cantidades, organización, municipio y fechas.
-- ---------------------------------------------------------------------

create table if not exists public.entregas (
  id              uuid primary key default gen_random_uuid(),
  organizacion_id uuid references public.organizaciones(id) on delete set null,
  municipio       text not null,
  -- Uno de los dos, como en `solicitud_items`: del catálogo o sugerido.
  item_id         text references public.catalogo_items(id),
  sugerencia_id   uuid references public.sugerencias_item(id) on delete set null,
  cantidad        numeric(8,2) not null check (cantidad > 0 and cantidad <= 9999),
  recibido_at     timestamptz not null default now(),
  -- La segunda confirmación. NULL mientras quien pidió no diga que sí.
  confirmada_por_solicitante_at timestamptz,
  -- Copia en texto: la solicitud va a desaparecer.
  solicitud_codigo text not null,
  conversacion_id uuid references public.conversaciones(id) on delete set null,
  es_prueba       boolean not null default false,
  constraint entregas_uno_u_otro check (num_nonnulls(item_id, sugerencia_id) = 1)
);

comment on table public.entregas is
  'SOBREVIVE al borrado de la solicitud, y por eso no tiene FK hacia ella: el código va copiado en texto. Sin PII — ítems, cantidades, organización, municipio y fechas. La planilla con nombres la exporta la fundación en el momento de la entrega y la custodia ella (regla Q).';

create index if not exists idx_entregas_organizacion
  on public.entregas(organizacion_id, recibido_at desc);

alter table public.entregas enable row level security;
revoke all on public.entregas from anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. El cruce, y por qué no puede ser una vista pública
--
-- ⚠ NO intentes resolver esto con `security_invoker`: `solicitudes` está
-- revocada y sin política de `select`, así que un aliado autenticado
-- recibiría «permission denied for table solicitudes», y `perfiles` solo
-- deja leer la fila propia, así que el join vaciaría el resultado igual
-- (§5.4).
--
-- La vista es interna. La única puerta es `coincidencias_para_aliado()`.
-- ---------------------------------------------------------------------

create or replace view public.v_cruces as
select
  s.id          as solicitud_id,
  s.codigo,
  s.municipio,
  s.flujo,
  s.organizacion_id,
  o.id          as ofertador_id,
  count(*)      as items_coincidentes,
  jsonb_agg(jsonb_build_object(
    'nombre',   coalesce(c.nombre, sg.nombre_propuesto),
    'cantidad', si.cantidad,
    'unidad',   coalesce(c.unidad, sg.unidad_sugerida, 'unidad')
  ) order by coalesce(c.orden, 9999)) as detalle
from public.solicitud_items si
join public.solicitudes s on s.id = si.solicitud_id
join public.ofrecimientos ofr
     on (ofr.item_id is not null and ofr.item_id = si.item_id)
     or (ofr.sugerencia_id is not null and ofr.sugerencia_id = si.sugerencia_id)
join public.perfiles o on o.id = ofr.perfil_id
left join public.catalogo_items c    on c.id = si.item_id
left join public.sugerencias_item sg on sg.id = si.sugerencia_id
where si.cubierto = false
  and ofr.disponible = true
  and public.estado_activo(s.estado)
  and s.expira_at > now()
  and s.municipio = any(o.municipios)
  -- ⚠ Imprescindible: sin esto, un aliado aparecería como candidato a
  -- entregarse cosas a sí mismo.
  and o.tipo = 'ofertador'
  and o.suspendido = false
group by s.id, s.codigo, s.municipio, s.flujo, s.organizacion_id, o.id;

revoke all on public.v_cruces from anon, authenticated;

comment on view public.v_cruces is
  'Vista INTERNA. Sin grant a anon ni authenticated: la única puerta es coincidencias_para_aliado(), que filtra por la organización de quien pregunta y por flujo = acompanado. Ver PLAN-V2 §5.4.';

create or replace function public.coincidencias_para_aliado()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by x->>'items_coincidentes' desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'solicitud_id',       v.solicitud_id,
        'codigo',             v.codigo,
        'municipio',          m.nombre || ', ' || m.departamento,
        'ofertador_id',       v.ofertador_id,
        'ofertador',          p.nombre_visible,
        'items_coincidentes', v.items_coincidentes,
        'detalle',            v.detalle,
        -- Si ya hay hilo con ese ofertador, el panel muestra «ya está en
        -- conversación» en vez de invitar otra vez.
        'ya_hay_hilo',        exists (select 1 from public.conversaciones c
                                       where c.solicitud_id = v.solicitud_id
                                         and c.ofertador_id = v.ofertador_id)
      ) as x
      from public.v_cruces v
      join public.municipios m on m.codigo_dane = v.municipio
      join public.perfiles p   on p.id = v.ofertador_id
      -- Las tres condiciones de §5.4, y la tercera es la que importa: sin
      -- ella el aliado vería solicitudes ANÓNIMAS del Flujo 1 en su panel,
      -- y el botón de conectar arrastraría a un solicitante que nunca
      -- aceptó nada a un hilo interno. Violaría la regla 3 y la R de golpe.
      where v.flujo = 'acompanado'
        and public.es_miembro_activo(v.organizacion_id, auth.uid())
    ) t;
$$;

revoke execute on function public.coincidencias_para_aliado() from public, anon;
grant  execute on function public.coincidencias_para_aliado() to authenticated;

-- ---------------------------------------------------------------------
-- 4. Registrar lo que llegó al acopio
--
-- Lo llama el aliado con la caja enfrente. Cada ítem que registra se tacha
-- en la solicitud, y de ahí sale el estado: `cumplida` si no queda nada
-- pendiente, `entregada_parcial` si falta algo.
--
-- El código de entrega que trae el ofertador es el uuid de la
-- conversación: opaco por construcción. NUNCA los cuatro últimos dígitos
-- del documento, que es lo que pide la regla 6 y lo que la gente haría por
-- comodidad.
-- ---------------------------------------------------------------------

create or replace function public.registrar_entrega(
  p_conversacion_id uuid,
  p_items           jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := auth.uid();
  v_conv     public.conversaciones;
  v_sol      public.solicitudes;
  v_item     jsonb;
  v_item_id  text;
  v_sug_id   uuid;
  v_n        integer := 0;
  v_pendientes integer;
begin
  select * into v_conv from public.conversaciones c where c.id = p_conversacion_id;

  if v_conv.id is null then
    raise exception 'Esa conversación no existe';
  end if;

  -- Solo la fundación registra entregas. Ni quien ofrece ni quien pide:
  -- el punto de la entrega en el acopio es que hay un tercero mirando.
  if not public.es_miembro_activo(v_conv.organizacion_id, v_uid) then
    raise exception 'No autorizado';
  end if;

  select * into v_sol from public.solicitudes s where s.id = v_conv.solicitud_id;

  if jsonb_array_length(p_items) < 1 then
    raise exception 'Marca al menos una cosa de las que llegaron';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_item_id := nullif(v_item->>'item_id', '');
    v_sug_id  := nullif(v_item->>'sugerencia_id', '')::uuid;

    if num_nonnulls(v_item_id, v_sug_id) <> 1 then
      raise exception 'Cada cosa entregada es del catálogo o sugerida, no las dos';
    end if;

    insert into public.entregas (
      organizacion_id, municipio, item_id, sugerencia_id, cantidad,
      solicitud_codigo, conversacion_id, es_prueba)
    values (
      v_conv.organizacion_id, v_sol.municipio, v_item_id, v_sug_id,
      (v_item->>'cantidad')::numeric, v_sol.codigo, v_conv.id, v_sol.es_prueba);

    update public.solicitud_items si
       set cubierto = true, cubierto_at = now(), cubierto_por = 'entrega'
     where si.solicitud_id = v_sol.id
       and ((v_item_id is not null and si.item_id = v_item_id)
         or (v_sug_id  is not null and si.sugerencia_id = v_sug_id));

    v_n := v_n + 1;
  end loop;

  select count(*) into v_pendientes
    from public.solicitud_items si
   where si.solicitud_id = v_sol.id and si.cubierto = false;

  -- `cumplida` no borra la solicitud: quien pidió tiene que poder
  -- confirmar que recibió, y para eso la solicitud sigue existiendo hasta
  -- que la cierre o venza. El borrado es de la Fase I.
  update public.solicitudes
     set estado = case when v_pendientes = 0 then 'cumplida' else 'entregada_parcial' end
   where id = v_sol.id;

  update public.conversaciones
     set estado = 'entregada'
   where id = p_conversacion_id;

  return jsonb_build_object(
    'registrados', v_n,
    'pendientes',  v_pendientes,
    'estado',      case when v_pendientes = 0 then 'cumplida' else 'entregada_parcial' end
  );
end;
$$;

revoke execute on function public.registrar_entrega(uuid,jsonb) from public, anon;
grant  execute on function public.registrar_entrega(uuid,jsonb) to authenticated;

-- ---------------------------------------------------------------------
-- 5. La segunda confirmación
--
-- La da quien pidió, con su token. Sin esto «entregado» sería la palabra
-- de una sola parte, y el registro que sobrevive vale bastante menos.
-- ---------------------------------------------------------------------

create or replace function public.confirmar_recepcion(p_token text, p_conversacion_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_n integer;
begin
  if not exists (
    select 1 from public.conversaciones c
      join public.solicitudes s on s.id = c.solicitud_id
     where c.id = p_conversacion_id
       and s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
  ) then
    raise exception 'No autorizado';
  end if;

  update public.entregas
     set confirmada_por_solicitante_at = now()
   where conversacion_id = p_conversacion_id
     and confirmada_por_solicitante_at is null;

  get diagnostics v_n = row_count;

  if v_n = 0 then
    raise exception 'No hay nada pendiente de confirmar en esta entrega';
  end if;

  return v_n;
end;
$$;

grant execute on function public.confirmar_recepcion(text,uuid) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 6. Tachar un ítem a mano
--
-- Dos puertas otra vez: quien pidió, con su token —«esto ya lo conseguí
-- por otro lado»— y el aliado de la organización que la acompaña.
-- ---------------------------------------------------------------------

create or replace function public.marcar_item_cubierto(
  p_item_id  uuid,
  p_cubierto boolean,
  p_token    text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sol public.solicitudes;
  v_ok  boolean := false;
begin
  select s.* into v_sol
    from public.solicitud_items si
    join public.solicitudes s on s.id = si.solicitud_id
   where si.id = p_item_id;

  if v_sol.id is null then
    raise exception 'Ese ítem no existe';
  end if;

  if p_token is not null then
    v_ok := v_sol.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  else
    v_ok := public.es_miembro_activo(v_sol.organizacion_id, auth.uid());
  end if;

  if not v_ok then
    raise exception 'No autorizado';
  end if;

  update public.solicitud_items
     set cubierto = p_cubierto,
         cubierto_at = case when p_cubierto then now() end,
         cubierto_por = case when p_cubierto then
                          case when p_token is not null then 'solicitante' else 'aliado' end
                        end
   where id = p_item_id;
end;
$$;

grant execute on function public.marcar_item_cubierto(uuid,boolean,text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. La planilla
--
-- Regla Q: la plataforma no es el archivo de la fundación. Esto entrega
-- los datos EN EL MOMENTO de la entrega, para que la fundación los
-- custodie en sus propios sistemas como responsable que es.
--
-- Lleva PII, así que va por el mismo camino que `leer_identidad`: exige
-- motivo, exige el permiso de ver identidades, y deja rastro. No es una
-- descarga: es un acceso a datos personales, y se registra como tal.
-- ---------------------------------------------------------------------

create or replace function public.exportar_planilla(p_conversacion_id uuid, p_motivo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv    public.conversaciones;
  v_ident   public.identidades;
  v_datos   jsonb;
begin
  if char_length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Escribe para qué necesitas la planilla';
  end if;

  select * into v_conv from public.conversaciones c where c.id = p_conversacion_id;

  if v_conv.id is null then
    raise exception 'Esa conversación no existe';
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
    'documento_tipo', v_ident.documento_tipo,
    'documento',      public.descifrar_texto(v_ident.documento_cifrado),
    'telefono',       public.descifrar_texto(v_ident.telefono_cifrado),
    'autorizacion_version', v_ident.autorizacion_version,
    'autorizacion_at',      v_ident.autorizacion_at,
    'entregas',       coalesce(v_datos, '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.exportar_planilla(uuid,text) from public, anon;
grant  execute on function public.exportar_planilla(uuid,text) to authenticated;

-- Comprobar:
--   select has_table_privilege('authenticated','public.v_cruces','SELECT');   -- f
--   select has_table_privilege('anon','public.entregas','SELECT');            -- f
--
--   -- El cruce solo devuelve acompañadas, y solo de la organización de
--   -- quien pregunta. Con un aliado de otra organización: 0 filas.
--   -- Y una entrega registrada tiene que sobrevivir al borrado de su
--   -- solicitud, con `conversacion_id` en null y `solicitud_codigo` intacto.

-- ---------------------------------------------------------------------
-- 8. La pantalla de la entrega necesita saber qué falta
--
-- `leer_conversacion` gana los ítems pendientes de la solicitud. Van con
-- su identificador porque la pantalla de verificación es una lista de
-- botones grandes —a media luz y con guantes— y cada botón manda ese id.
--
-- Solo los pendientes: lo ya entregado no vuelve a la lista, que es lo
-- que evita registrar dos veces la misma caja.
-- ---------------------------------------------------------------------

create or replace function public.leer_conversacion(p_conversacion_id uuid)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_rol  text := public.rol_en_conversacion(p_conversacion_id);
  v_conv public.conversaciones;
begin
  if v_rol is null then
    raise exception 'No autorizado';
  end if;

  select * into v_conv from public.conversaciones c where c.id = p_conversacion_id;

  return jsonb_build_object(
    'id',       v_conv.id,
    'estado',   v_conv.estado,
    'mi_rol',   v_rol,
    'directa',  v_conv.directa,
    'codigo',   (select s.codigo from public.solicitudes s where s.id = v_conv.solicitud_id),
    'acopio',   (select jsonb_build_object('nombre', o.nombre,
                          'direccion', o.direccion_acopio,
                          'horario', o.horario_acopio)
                   from public.organizaciones o where o.id = v_conv.organizacion_id),
    'pendientes', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id',            si.id,
               'item_id',       si.item_id,
               'sugerencia_id', si.sugerencia_id,
               'nombre',        coalesce(c.nombre, sg.nombre_propuesto),
               'cantidad',      si.cantidad,
               'unidad',        coalesce(c.unidad, sg.unidad_sugerida, 'unidad')
             ) order by coalesce(c.orden, 9999)), '[]'::jsonb)
        from public.solicitud_items si
        left join public.catalogo_items c    on c.id = si.item_id
        left join public.sugerencias_item sg on sg.id = si.sugerencia_id
       where si.solicitud_id = v_conv.solicitud_id and si.cubierto = false),
    'mensajes', public.mensajes_de(p_conversacion_id)
  );
end;
$$;

revoke execute on function public.leer_conversacion(uuid) from public, anon;
grant  execute on function public.leer_conversacion(uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 9. Invitar desde el panel — F7
--
-- El aliado ve la coincidencia y abre el hilo él mismo. Nace `abierta` y
-- con él ya a cargo: es la regla L cumplida desde el primer segundo, y de
-- paso evita el estado raro de un hilo que alguien abrió para otro.
--
-- ⚠ El primer mensaje lo firma el ALIADO, nunca el ofertador. Crear un
-- hilo en nombre de alguien y ponerle palabras es exactamente lo que no
-- se puede hacer: quien ofrece recibe una invitación, no un mensaje suyo
-- que no escribió.
-- ---------------------------------------------------------------------

create or replace function public.invitar_a_conversacion(
  p_solicitud_id uuid,
  p_ofertador_id uuid,
  p_mensaje      text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_sol  public.solicitudes;
  v_conv uuid;
begin
  select * into v_sol from public.solicitudes s
   where s.id = p_solicitud_id
     and public.estado_activo(s.estado)
     and s.expira_at > now();

  if v_sol.id is null then
    raise exception 'Esa solicitud ya no está disponible';
  end if;

  if v_sol.flujo <> 'acompanado' then
    raise exception 'Esa solicitud no tiene acompañamiento';
  end if;

  if not public.es_miembro_activo(v_sol.organizacion_id, v_uid) then
    raise exception 'No autorizado';
  end if;

  if char_length(trim(p_mensaje)) < 10 or char_length(p_mensaje) > 1000 then
    raise exception 'El mensaje debe tener entre 10 y 1000 caracteres';
  end if;

  if public.contiene_contacto(p_mensaje) then
    raise exception 'No escribas teléfonos, correos ni enlaces de mensajería';
  end if;

  if not exists (select 1 from public.perfiles p
                  where p.id = p_ofertador_id
                    and p.tipo = 'ofertador'
                    and p.suspendido = false) then
    raise exception 'Esa persona no está disponible para ofrecer';
  end if;

  insert into public.conversaciones
    (solicitud_id, ofertador_id, aliado_id, organizacion_id, estado)
  values
    (v_sol.id, p_ofertador_id, v_uid, v_sol.organizacion_id, 'abierta')
  on conflict (solicitud_id, ofertador_id) do nothing
  returning id into v_conv;

  if v_conv is null then
    raise exception 'Ya hay una conversación con esa persona sobre esta solicitud';
  end if;

  insert into public.mensajes (conversacion_id, autor_rol, autor_perfil_id, cuerpo)
  values (v_conv, 'aliado', v_uid, trim(p_mensaje));

  update public.solicitudes set estado = 'en_coordinacion'
   where id = v_sol.id and estado = 'abierta';

  return v_conv;
end;
$$;

revoke execute on function public.invitar_a_conversacion(uuid,uuid,text) from public, anon;
grant  execute on function public.invitar_a_conversacion(uuid,uuid,text) to authenticated;


-- =====================================================================
-- Ciclo de vida, moderación y habeas data (Fase I). Ver migración v2-i1
-- para el porqué de cada decisión; aquí va el estado final.
-- =====================================================================

alter table public.metricas
  add column if not exists con_aliado boolean not null default false;

comment on column public.metricas.con_aliado is
  'Si alguien de una fundación llegó a hacerse cargo. `flujo = acompanado` dice que se pidió acompañamiento; esto dice si de verdad lo hubo.';

-- ---------------------------------------------------------------------
-- 2. La única salida del Flujo 2
--
-- Borra la identidad, cierra los hilos y devuelve la solicitud a
-- `directo`. Los mensajes NO se borran: contienen palabras de otras dos
-- personas, y el hilo cerrado muere igual con la solicitud.
--
-- No la llama nadie desde un menú. La llaman las tres situaciones de §7,
-- y las tres son decisiones, no preferencias.
-- ---------------------------------------------------------------------

create or replace function public.devolver_a_directo(
  p_solicitud_id uuid,
  p_motivo       text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if char_length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Escribe por qué se devuelve al flujo directo';
  end if;

  -- La identidad primero: es lo que hay que quitar de en medio.
  delete from public.identidades where solicitud_id = p_solicitud_id;

  update public.conversaciones
     set estado = 'cerrada', cerrada_at = now()
   where solicitud_id = p_solicitud_id
     and estado <> 'cerrada';

  -- El CHECK de coherencia exige que `directo` no tenga organización, así
  -- que las dos columnas se tocan a la vez o no se toca ninguna.
  update public.solicitudes
     set flujo = 'directo',
         organizacion_id = null,
         estado = case when estado = 'en_coordinacion' then 'abierta' else estado end
   where id = p_solicitud_id;
end;
$$;

revoke execute on function public.devolver_a_directo(uuid,text) from public, anon, authenticated;

comment on function public.devolver_a_directo(uuid,text) is
  'La única salida del Flujo 2 (§7). Sin grant a nadie: la llaman otras RPC security definer —supresión pedida por el titular, moderación— y nunca un cliente. No hay botón de «volver a anónimo».';

-- ---------------------------------------------------------------------
-- 3. `expirar_solicitudes` deja de borrar coordinaciones vivas
--
-- Tres pasos, y el orden es el que hace que funcione:
--
--   1. Auto-renovar las vencidas que tengan hilo vivo, con TECHO DURO de
--      5 días desde que se publicaron. El techo existe para que una
--      coordinación estancada no mantenga una identidad cifrada viva para
--      siempre: la promesa es que esto se borra, no que se borra pronto.
--   2. Cerrar los hilos de las que ya no se renuevan. Al llegar al techo
--      se cierra, no se prolonga.
--   3. Métrica y borrado, ahora con `cumplida` de verdad.
--
-- ⚠ Sigue sin tener EXECUTE para nadie: la dispara `pg_cron`. Nunca se
-- llama a mano — para probar la lógica, se hace una variante acotada a una
-- sola fila.
-- ---------------------------------------------------------------------

create or replace function public.expirar_solicitudes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_n integer;
begin
  -- 1 · Lo que sigue vivo se renueva solo.
  update public.solicitudes s
     set expira_at = now() + interval '72 hours'
   where s.expira_at <= now()
     and s.creada_at > now() - interval '5 days'
     and exists (select 1 from public.conversaciones c
                  where c.solicitud_id = s.id and c.estado <> 'cerrada');

  -- 2 · Lo que llegó al techo se cierra antes de borrarse, para que el
  -- hilo no desaparezca a mitad de una frase.
  update public.conversaciones c
     set estado = 'cerrada', cerrada_at = now()
   where c.estado <> 'cerrada'
     and exists (select 1 from public.solicitudes s
                  where s.id = c.solicitud_id and s.expira_at <= now());

  -- 3 · La métrica, ahora sin mentir: `entregada_parcial` y `cumplida`
  -- cuentan como cumplidas, porque hubo entrega.
  insert into public.metricas (
    municipio, categoria, cumplida, horas_hasta_respuesta,
    horas_hasta_cierre, num_respuestas, es_prueba, flujo, con_aliado)
  select s.municipio, s.categoria,
         s.estado in ('cumplida','entregada_parcial'),
         extract(epoch from (min(r.creada_at) - s.creada_at)) / 3600,
         extract(epoch from (s.expira_at - s.creada_at)) / 3600,
         count(r.id), s.es_prueba, s.flujo,
         exists (select 1 from public.conversaciones c
                  where c.solicitud_id = s.id and c.aliado_id is not null)
    from public.solicitudes s
    left join public.respuestas r on r.solicitud_id = s.id
   where s.expira_at <= now()
   group by s.id, s.municipio, s.categoria, s.creada_at, s.expira_at,
            s.es_prueba, s.flujo, s.estado;

  delete from public.solicitudes where expira_at <= now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke execute on function public.expirar_solicitudes() from public, anon, authenticated;

-- Y `cerrar_solicitud` también, por lo mismo: si alguien cierra una
-- solicitud que estuvo acompañada, la métrica tiene que decirlo.
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
    horas_hasta_cierre, num_respuestas, es_prueba, flujo, con_aliado)
  select v_sol.municipio, v_sol.categoria, p_cumplida,
         extract(epoch from (min(r.creada_at) - v_sol.creada_at)) / 3600,
         extract(epoch from (now() - v_sol.creada_at)) / 3600,
         count(r.id), v_sol.es_prueba, v_sol.flujo,
         exists (select 1 from public.conversaciones c
                  where c.solicitud_id = v_sol.id and c.aliado_id is not null)
    from public.respuestas r where r.solicitud_id = v_sol.id;

  delete from public.solicitudes where id = v_sol.id;   -- CASCADE limpia todo
end;
$$;

grant execute on function public.cerrar_solicitud(text, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Moderar una solicitud deja de ser una demolición
--
-- Antes: `delete from solicitudes` y ya. Un moderador destruía una
-- coordinación viva sin avisarle al aliado ni al ofertador, y sin dejar
-- rastro en `metricas`. Ahora se cierra, se cuenta y después se borra.
-- ---------------------------------------------------------------------

create or replace function public.resolver_reporte(p_reporte_id uuid, p_borrar boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rep public.reportes;
  v_sol public.solicitudes;
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  select * into v_rep from public.reportes where id = p_reporte_id;
  if not found then raise exception 'Reporte no encontrado'; end if;

  if p_borrar then
    if v_rep.tipo_objeto = 'solicitud' then
      select * into v_sol from public.solicitudes where id = v_rep.objeto_id;

      if v_sol.id is not null then
        -- Cerrar los hilos antes de borrar: los participantes ven que se
        -- cerró, no un hueco donde había una conversación.
        update public.conversaciones
           set estado = 'cerrada', cerrada_at = now()
         where solicitud_id = v_sol.id and estado <> 'cerrada';

        -- Y dejar la métrica, que si no se pierde: es la única huella de
        -- que esa solicitud existió.
        insert into public.metricas (
          municipio, categoria, cumplida, horas_hasta_respuesta,
          horas_hasta_cierre, num_respuestas, es_prueba, flujo, con_aliado)
        select v_sol.municipio, v_sol.categoria, false,
               extract(epoch from (min(r.creada_at) - v_sol.creada_at)) / 3600,
               extract(epoch from (now() - v_sol.creada_at)) / 3600,
               count(r.id), v_sol.es_prueba, v_sol.flujo,
               exists (select 1 from public.conversaciones c
                        where c.solicitud_id = v_sol.id and c.aliado_id is not null)
          from public.respuestas r where r.solicitud_id = v_sol.id;

        delete from public.solicitudes where id = v_sol.id;
      end if;

    elsif v_rep.tipo_objeto = 'respuesta' then
      delete from public.respuestas where id = v_rep.objeto_id;
    elsif v_rep.tipo_objeto = 'perfil' then
      update public.perfiles set suspendido = true where id = v_rep.objeto_id;
    elsif v_rep.tipo_objeto = 'entidad' then
      -- Se retira, no se borra: si el enlace se recupera, se vuelve a subir
      -- sin tener que escribir la ficha entera otra vez.
      update public.entidades set activa = false, actualizada_at = now()
       where id = v_rep.objeto_id;
    end if;
  end if;

  update public.reportes set atendido = true where id = p_reporte_id;
end;
$$;

revoke execute on function public.resolver_reporte(uuid,boolean) from public, anon;
grant  execute on function public.resolver_reporte(uuid,boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Bloquear a quien ofrece
--
-- Cierra el hilo y suspende el perfil. Lo puede hacer el administrador, y
-- el aliado con permiso de moderar sobre los hilos de su organización:
-- quien está viendo el problema en tiempo real es la fundación, y hacerla
-- esperar a que un administrador se despierte es dejarla sola.
-- ---------------------------------------------------------------------

create or replace function public.bloquear_ofertador(
  p_conversacion_id uuid,
  p_motivo          text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_conv public.conversaciones;
begin
  if char_length(trim(coalesce(p_motivo, ''))) < 5 then
    raise exception 'Escribe por qué se bloquea';
  end if;

  select * into v_conv from public.conversaciones c where c.id = p_conversacion_id;

  if v_conv.id is null then
    raise exception 'Esa conversación no existe';
  end if;

  if not (public.es_admin(v_uid)
          or exists (select 1 from public.miembros_organizacion mo
                      where mo.organizacion_id = v_conv.organizacion_id
                        and mo.perfil_id = v_uid
                        and mo.estado = 'activo'
                        and mo.puede_moderar)) then
    raise exception 'No autorizado';
  end if;

  update public.conversaciones
     set estado = 'cerrada', cerrada_at = now()
   where id = p_conversacion_id;

  update public.perfiles set suspendido = true where id = v_conv.ofertador_id;
end;
$$;

revoke execute on function public.bloquear_ofertador(uuid,text) from public, anon;
grant  execute on function public.bloquear_ofertador(uuid,text) to authenticated;

-- ---------------------------------------------------------------------
-- 6. Habeas data — artículos 14 y 15 de la Ley 1581
--
-- Consultar y suprimir, con el token y sin cuenta. En Flujo 1 esta
-- pantalla no hace falta porque no hay nada que consultar; se deja que
-- responda igual, diciendo justamente eso.
--
-- `mis_datos` NO descifra el documento: devuelve el tipo y los cuatro
-- últimos, que es lo que hace falta para reconocer que son los suyos. Ver
-- su propia cédula completa en pantalla no le dice nada que no sepa, y
-- multiplica los sitios por donde ese dato puede salir.
-- ---------------------------------------------------------------------

create or replace function public.mis_datos(p_token text)
returns jsonb
language plpgsql
security definer
stable
set search_path = ''
as $$
declare
  v_sol   public.solicitudes;
  v_ident public.identidades;
begin
  select * into v_sol from public.solicitudes s
   where s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  if v_sol.id is null then
    raise exception 'Solicitud no encontrada o vencida';
  end if;

  select * into v_ident from public.identidades i where i.solicitud_id = v_sol.id;

  return jsonb_build_object(
    'codigo',      v_sol.codigo,
    'flujo',       v_sol.flujo,
    'municipio',   (select m.nombre || ', ' || m.departamento from public.municipios m
                     where m.codigo_dane = v_sol.municipio),
    'barrio',      v_sol.barrio,
    'nota',        v_sol.nota,
    'creada_at',   v_sol.creada_at,
    'expira_at',   v_sol.expira_at,
    'organizacion', (select o.nombre from public.organizaciones o
                      where o.id = v_sol.organizacion_id),
    'identidad', case when v_ident.id is null then null else jsonb_build_object(
      'documento_tipo',       v_ident.documento_tipo,
      'documento_ultimos4',   v_ident.documento_ultimos4,
      'tiene_telefono',       v_ident.telefono_cifrado is not null,
      'autorizacion_version', v_ident.autorizacion_version,
      'autorizacion_at',      v_ident.autorizacion_at
    ) end,
    -- Quién ha visto esos datos, cuándo y con qué motivo. Es el derecho a
    -- saber, y es exactamente para lo que existe `accesos_identidad`.
    'accesos', case when v_ident.id is null then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object(
               'rol',    a.rol_lector,
               'motivo', a.motivo,
               'cuando', a.leida_at
             ) order by a.leida_at desc), '[]'::jsonb)
        from public.accesos_identidad a where a.identidad_id = v_ident.id) end,
    'entregas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'item',       coalesce(c.nombre, sg.nombre_propuesto),
               'cantidad',   e.cantidad,
               'unidad',     coalesce(c.unidad, sg.unidad_sugerida, 'unidad'),
               'confirmada', e.confirmada_por_solicitante_at is not null
             ) order by e.recibido_at), '[]'::jsonb)
        from public.entregas e
        left join public.catalogo_items c    on c.id = e.item_id
        left join public.sugerencias_item sg on sg.id = e.sugerencia_id
       where e.solicitud_codigo = v_sol.codigo)
  );
end;
$$;

grant execute on function public.mis_datos(text) to anon, authenticated;

-- Supresión. Borra la identidad, devuelve la solicitud a `directo` y
-- cierra los hilos.
--
-- ⚠ El hilo NO se borra: contiene palabras de otras dos personas. Lo que
-- se hace con los mensajes del titular es reemplazar el cuerpo, dejando el
-- rol y la fecha, para que la conversación siga siendo legible sin
-- conservar lo que él escribió. El hilo muere igual con la solicitud.
create or replace function public.suprimir_mis_datos(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sol public.solicitudes;
  v_n   integer;
begin
  select * into v_sol from public.solicitudes s
   where s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  if v_sol.id is null then
    raise exception 'Solicitud no encontrada o vencida';
  end if;

  if v_sol.flujo = 'directo' then
    raise exception 'Esta solicitud no tiene datos personales guardados';
  end if;

  update public.mensajes m
     set cuerpo = '[mensaje suprimido a petición del titular]'
   where m.autor_rol = 'solicitante'
     and m.conversacion_id in (select c.id from public.conversaciones c
                                where c.solicitud_id = v_sol.id);
  get diagnostics v_n = row_count;

  perform public.devolver_a_directo(v_sol.id, 'Supresión pedida por el titular');

  return jsonb_build_object('mensajes_suprimidos', v_n);
end;
$$;

grant execute on function public.suprimir_mis_datos(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. Lo que el administrador necesita ver
--
-- La cola de hilos sin fundación —el fallback de §8-F5— y la bitácora de
-- accesos a identidades. Las dos por RPC, porque las tablas están
-- revocadas y así tiene que seguir.
-- ---------------------------------------------------------------------

create or replace function public.panel_admin_flujo2()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select case when not public.es_admin(auth.uid()) then '{}'::jsonb
  else jsonb_build_object(
    'sin_aliado', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id',        c.id,
               'codigo',    s.codigo,
               'municipio', m.nombre || ', ' || m.departamento,
               'creada_at', c.creada_at
             ) order by c.creada_at), '[]'::jsonb)
        from public.conversaciones c
        join public.solicitudes s on s.id = c.solicitud_id
        join public.municipios m  on m.codigo_dane = s.municipio
       where c.estado = 'esperando_aliado'),
    -- Sin PII: quién leyó, cuándo y por qué. Nunca qué leyó.
    'accesos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'rol',    a.rol_lector,
               'motivo', a.motivo,
               'cuando', a.leida_at,
               'huerfano', a.identidad_id is null
             ) order by a.leida_at desc), '[]'::jsonb)
        from (select * from public.accesos_identidad
               order by leida_at desc limit 50) a),
    'hilos_abiertos', (select count(*) from public.conversaciones
                        where estado not in ('cerrada','entregada'))
  ) end;
$$;

revoke execute on function public.panel_admin_flujo2() from public, anon;
grant  execute on function public.panel_admin_flujo2() to authenticated;

-- Comprobar, contra una solicitud de PRUEBA y NUNCA llamando a
-- `expirar_solicitudes()` a mano:
--
--   -- Auto-renovado: con hilo vivo y menos de 5 días, la fecha se mueve.
--   -- Con más de 5 días, no se mueve y el hilo queda cerrado.
--   -- La métrica de una `entregada_parcial` sale con cumplida = true.
--   -- `suprimir_mis_datos` deja la solicitud en `directo`, sin identidad,
--   -- con los hilos cerrados y los mensajes del titular reemplazados.


create or replace function public.soy_aliado()
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
     where m.perfil_id = auth.uid()
       and m.estado in ('activo','pendiente')
       and o.activa
  );
$$;

revoke execute on function public.soy_aliado() from public, anon;
grant  execute on function public.soy_aliado() to authenticated;

comment on function public.soy_aliado() is
  'Solo para decidir si el encabezado muestra la pestaña «Mi organización». No autoriza nada: quien decide qué puede hacer un miembro es es_miembro_activo(), y cada RPC lo vuelve a comprobar.';


-- =====================================================================
-- Quien puede ofrecer, definido UNA sola vez (arreglo v2-i7). Estaba
-- escrito de tres formas distintas y por eso fallaba invitar a un
-- servidor con matricula que ademas tiene insumos.
-- =====================================================================

create or replace function public.puede_ofrecer(p_perfil_id uuid)
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
     where p.id = p_perfil_id
       and p.suspendido = false
       -- Con contacto público. Deja fuera a los aliados, que no lo tienen:
       -- un aliado no puede ser candidato a entregarse cosas a sí mismo.
       and p.contacto_publico is not null
  );
$$;

revoke execute on function public.puede_ofrecer(uuid) from public, anon;
grant  execute on function public.puede_ofrecer(uuid) to authenticated;

comment on function public.puede_ofrecer(uuid) is
  'Quién puede ofrecer ayuda: no suspendido y con contacto público. Definición única — la usan invitar_a_conversacion y v_cruces, y es la misma que exige responder_solicitud. No mira el tipo del perfil: un servidor con matrícula también puede tener cobijas.';

-- 1 · La invitación desde el panel del aliado.
create or replace function public.invitar_a_conversacion(
  p_solicitud_id uuid,
  p_ofertador_id uuid,
  p_mensaje      text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := auth.uid();
  v_sol  public.solicitudes;
  v_conv uuid;
begin
  select * into v_sol from public.solicitudes s
   where s.id = p_solicitud_id
     and public.estado_activo(s.estado)
     and s.expira_at > now();

  if v_sol.id is null then
    raise exception 'Esa solicitud ya no está disponible';
  end if;

  if v_sol.flujo <> 'acompanado' then
    raise exception 'Esa solicitud no tiene acompañamiento';
  end if;

  if not public.es_miembro_activo(v_sol.organizacion_id, v_uid) then
    raise exception 'No autorizado';
  end if;

  if char_length(trim(p_mensaje)) < 10 or char_length(p_mensaje) > 1000 then
    raise exception 'El mensaje debe tener entre 10 y 1000 caracteres';
  end if;

  if public.contiene_contacto(p_mensaje) then
    raise exception 'No escribas teléfonos, correos ni enlaces de mensajería';
  end if;

  if not public.puede_ofrecer(p_ofertador_id) then
    raise exception 'Esa persona no está disponible para ofrecer';
  end if;

  -- ⚠ El primer mensaje lo firma el ALIADO, nunca el ofertador. Crear un
  -- hilo en nombre de alguien y ponerle palabras es lo que no se puede
  -- hacer: quien ofrece recibe una invitación, no un mensaje suyo que no
  -- escribió.
  insert into public.conversaciones
    (solicitud_id, ofertador_id, aliado_id, organizacion_id, estado)
  values
    (v_sol.id, p_ofertador_id, v_uid, v_sol.organizacion_id, 'abierta')
  on conflict (solicitud_id, ofertador_id) do nothing
  returning id into v_conv;

  if v_conv is null then
    raise exception 'Ya hay una conversación con esa persona sobre esta solicitud';
  end if;

  insert into public.mensajes (conversacion_id, autor_rol, autor_perfil_id, cuerpo)
  values (v_conv, 'aliado', v_uid, trim(p_mensaje));

  update public.solicitudes set estado = 'en_coordinacion'
   where id = v_sol.id and estado = 'abierta';

  return v_conv;
end;
$$;

revoke execute on function public.invitar_a_conversacion(uuid,uuid,text) from public, anon;
grant  execute on function public.invitar_a_conversacion(uuid,uuid,text) to authenticated;

-- 2 · El cruce por inventario. Con `tipo = 'ofertador'` se quedaban fuera
-- los profesionales con matrícula que además declaran insumos, que es
-- justo a quien `ofertadores_publicos` sí muestra.
create or replace view public.v_cruces as
select
  s.id          as solicitud_id,
  s.codigo,
  s.municipio,
  s.flujo,
  s.organizacion_id,
  o.id          as ofertador_id,
  count(*)      as items_coincidentes,
  jsonb_agg(jsonb_build_object(
    'nombre',   coalesce(c.nombre, sg.nombre_propuesto),
    'cantidad', si.cantidad,
    'unidad',   coalesce(c.unidad, sg.unidad_sugerida, 'unidad')
  ) order by coalesce(c.orden, 9999)) as detalle
from public.solicitud_items si
join public.solicitudes s on s.id = si.solicitud_id
join public.ofrecimientos ofr
     on (ofr.item_id is not null and ofr.item_id = si.item_id)
     or (ofr.sugerencia_id is not null and ofr.sugerencia_id = si.sugerencia_id)
join public.perfiles o on o.id = ofr.perfil_id
left join public.catalogo_items c    on c.id = si.item_id
left join public.sugerencias_item sg on sg.id = si.sugerencia_id
where si.cubierto = false
  and ofr.disponible = true
  and public.estado_activo(s.estado)
  and s.expira_at > now()
  and s.municipio = any(o.municipios)
  and public.puede_ofrecer(o.id)
group by s.id, s.codigo, s.municipio, s.flujo, s.organizacion_id, o.id;

revoke all on public.v_cruces from anon, authenticated;


-- ---------------------------------------------------------------------
-- Avisos. Ver migración v2-i9.
--
-- Cinco cosas le pueden pasar a una cuenta, y las cinco se derivan de
-- datos que ya existen. NO hay tabla de notificaciones: con
-- `perfiles.avisos_vistos_at` basta, y lo nuevo es todo lo posterior.
--
-- En el chat no hay menciones que avisar: la regla M bloquea arrobas y
-- teléfonos, así que no hay a quién mencionar.
-- ---------------------------------------------------------------------

create or replace function public.mis_avisos()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(x order by (x->>'fecha') desc), '[]'::jsonb)
    from (
      select x from (
        -- 1 · El último mensaje de cada hilo mío, si lo escribió otra
        --     persona. Uno por hilo, no uno por mensaje: veinte mensajes
        --     de la misma conversación son una novedad, no veinte.
        select jsonb_build_object(
                 'tipo',   'mensaje',
                 'texto',  case u.autor_rol
                             when 'solicitante' then 'Quien pidió ayuda escribió en '
                             when 'aliado'      then 'La fundación escribió en '
                             when 'admin'       then 'Moderación escribió en '
                             else 'Quien ofrece escribió en '
                           end || u.codigo,
                 'fecha',  u.creado_at,
                 'href',   '/aliado'
               ) as x, u.creado_at as fecha
          from (
            select distinct on (c.id)
                   m.autor_rol, m.autor_perfil_id, m.creado_at, s.codigo
              from public.mensajes m
              join public.conversaciones c on c.id = m.conversacion_id
              join public.solicitudes s    on s.id = c.solicitud_id
             where m.oculto = false
               and (c.ofertador_id = auth.uid()
                    or public.es_miembro_activo(c.organizacion_id, auth.uid()))
               -- El primer mensaje de un aliado en MI hilo es la
               -- invitación, y esa ya sale abajo con su propio nombre.
               and not (c.ofertador_id = auth.uid()
                        and m.autor_rol = 'aliado'
                        and m.creado_at = (select min(m2.creado_at)
                                             from public.mensajes m2
                                            where m2.conversacion_id = c.id))
             order by c.id, m.creado_at desc
          ) u
         -- Fuera del DISTINCT ON, no dentro: si el último mensaje lo
         -- escribí yo no hay novedad, y tampoco la hay en el penúltimo,
         -- que ya había leído cuando contesté.
         -- (`is distinct from` y no `<>`: el solicitante no tiene cuenta y
         -- su `autor_perfil_id` es nulo.)
         where u.autor_perfil_id is distinct from auth.uid()

        union all

        -- 2 · Me invitaron a coordinar: el hilo lo abrió un aliado.
        select jsonb_build_object(
                 'tipo',  'invitacion',
                 'texto', 'Te invitaron a coordinar la entrega de ' || s.codigo,
                 'fecha', c.creada_at,
                 'href',  '/aliado'
               ), c.creada_at
          from public.conversaciones c
          join public.solicitudes s on s.id = c.solicitud_id
         where c.ofertador_id = auth.uid()
           and (select m.autor_rol from public.mensajes m
                 where m.conversacion_id = c.id
                 order by m.creado_at limit 1) = 'aliado'

        union all

        -- 3 · Hilos de mi organización que nadie ha atendido.
        select jsonb_build_object(
                 'tipo',  'sin_atender',
                 'texto', 'Nadie se ha hecho cargo de la conversación de ' || s.codigo,
                 'fecha', c.creada_at,
                 'href',  '/aliado'
               ), c.creada_at
          from public.conversaciones c
          join public.solicitudes s on s.id = c.solicitud_id
         where c.aliado_id is null
           and c.estado in ('esperando_aliado','asignada')
           and public.es_miembro_activo(c.organizacion_id, auth.uid())

        union all

        -- 4 · Una solicitud que respondí pasó a tener acompañamiento, y
        --     todavía no hay conversación conmigo.
        select jsonb_build_object(
                 'tipo',  'acompanamiento',
                 'texto', 'Ahora una fundación acompaña ' || s.codigo || ', donde ofreciste ayuda',
                 'fecha', s.acompanamiento_at,
                 'href',  '/responder/' || s.codigo
               ), s.acompanamiento_at
          from public.respuestas r
          join public.solicitudes s on s.id = r.solicitud_id
         where r.autor_id = auth.uid()
           and s.flujo = 'acompanado'
           and s.acompanamiento_at is not null
           and not exists (select 1 from public.conversaciones c
                            where c.solicitud_id = s.id
                              and c.ofertador_id = auth.uid())

        union all

        -- 5 · Reportes sin atender. Solo para el administrador.
        select jsonb_build_object(
                 'tipo',  'reporte',
                 'texto', 'Hay un reporte sin atender',
                 'fecha', rp.creado_at,
                 'href',  '/admin'
               ), rp.creado_at
          from public.reportes rp
         where rp.atendido = false
           and public.es_admin(auth.uid())
      ) t
      order by fecha desc
      -- Quien tenga más de treinta avisos sin mirar no necesita el treinta
      -- y uno: necesita abrir la aplicación.
      limit 30
    ) u;
$$;

revoke execute on function public.mis_avisos() from public, anon;
grant  execute on function public.mis_avisos() to authenticated;

create or replace function public.marcar_avisos_vistos()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.perfiles set avisos_vistos_at = now() where id = auth.uid();
$$;

revoke execute on function public.marcar_avisos_vistos() from public, anon;
grant  execute on function public.marcar_avisos_vistos() to authenticated;

-- Todo lo que el encabezado necesita, en una consulta: corre en CADA carga
-- de CADA página, así que el contador viaja en la que ya existía en vez de
-- abrir una cuarta.
create or replace function public.estado_encabezado()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select jsonb_build_object(
    'coordinacion', case
      when public.soy_aliado() then 'organizacion'
      when exists (select 1 from public.conversaciones c
                    where c.ofertador_id = auth.uid()) then 'coordinacion'
    end,
    'avisos_sin_ver', (
      select count(*)
        from jsonb_array_elements(public.mis_avisos()) a
       where (a->>'fecha')::timestamptz >
             coalesce((select p.avisos_vistos_at from public.perfiles p
                        where p.id = auth.uid()),
                      '-infinity'::timestamptz)
    )
  );
$$;

revoke execute on function public.estado_encabezado() from public, anon;
grant  execute on function public.estado_encabezado() to authenticated;

comment on function public.estado_encabezado() is
  'Todo lo que el encabezado necesita saber de quien mira, en una consulta: si se dibuja la pestaña de /aliado y con qué nombre, y cuántos avisos hay sin ver. No autoriza nada.';


-- =====================================================================
-- v3 · Fase S1 — Módulo de Servicios
--
-- Volcado de `supabase/migraciones/v3-s1-esquema.sql`. Va al final
-- porque referencia tablas de arriba (`municipios`, `perfiles`,
-- `organizaciones`, `sugerencias_item`, `reportes`). Si se cambia una de
-- las dos copias, se cambia la otra: `comparar-esquema.mjs` solo mira
-- funciones, no tablas.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. `zonas` — comuna, corregimiento o barrio
--
-- No existía nada por debajo del municipio: `solicitudes.barrio` es texto
-- libre. Aquí hace falta filtrar de verdad, y en Cali «comuna» es una
-- división administrativa real, no una manera de hablar.
--
-- Se siembra Cali y nada más. En los demás municipios el proveedor
-- escribe su zona a mano en `proveedores.zona_texto`, con el mismo filtro
-- de PII que el barrio. Sembrar los barrios de 1.121 municipios no es
-- trabajo de esta migración y probablemente no es trabajo de nadie.
-- ---------------------------------------------------------------------

create table if not exists public.zonas (
  id        uuid primary key default gen_random_uuid(),
  municipio text not null references public.municipios(codigo_dane),
  nombre    text not null check (char_length(trim(nombre)) between 2 and 60),
  tipo      text not null check (tipo in ('comuna','corregimiento','barrio')),
  activa    boolean not null default true,
  orden     integer not null default 0,
  unique (municipio, nombre)
);

comment on table public.zonas is
  'División por debajo del municipio, para filtrar el directorio de servicios. Solo Cali viene sembrada (seed-zonas.sql); en el resto la zona se escribe a mano. No es un dato personal: es geografía.';

create index if not exists idx_zonas_municipio
  on public.zonas(municipio, orden, nombre) where activa;

-- ---------------------------------------------------------------------
-- 2. `catalogo_oficios` — la taxonomía del rebusque
--
-- Hermana de `catalogo_servicios`, no su reemplazo. Aquella exige
-- matrícula verificable; esta no exige nada, y por eso lleva `riesgo`.
-- ---------------------------------------------------------------------

create table if not exists public.catalogo_oficios (
  id     text primary key,
  grupo  text not null check (grupo in
           ('comida','belleza','confeccion','transporte','aseo',
            'cuidado','reparacion','otros')),
  nombre text not null check (char_length(trim(nombre)) between 2 and 60),
  -- Regla S. `alto` = el daño posible de un mal actor no es económico.
  riesgo text not null default 'bajo' check (riesgo in ('bajo','alto')),
  activo boolean not null default true,
  orden  integer not null default 0
);

comment on table public.catalogo_oficios is
  'PROHIBIDO agregar oficios que exijan matrícula (reconstrucción o revisión estructural, salud, gas, instalaciones eléctricas, asesoría jurídica): esos van en catalogo_servicios, que sí la verifica. Y como allá, PROHIBIDO rescate, búsqueda de personas, urgencias y atención prehospitalaria: es competencia de bomberos, Defensa Civil y la línea 123. Ver CLAUDE.md regla 5 y PLAN-V3 §2.';

comment on column public.catalogo_oficios.riesgo is
  'Regla S de PLAN-V3. Un oficio en `alto` no se publica si el proveedor no tiene teléfono verificado Y una referencia confirmada. Lo aplica la vista proveedores_publicos. Bajar un oficio de alto a bajo es una decisión con consecuencias sobre personas, no una corrección de datos.';

-- ---------------------------------------------------------------------
-- 3. Sugerencias de oficio
--
-- El documento pide «opción de escribir el oficio si no aparece». Se
-- reusa la cola que ya existe en vez de abrir una segunda con su propio
-- panel: `sugerencias_item` gana un `tipo` y un `origen` más.
--
-- Los `add ... if not exists` y el baile de los CHECK son para que la
-- migración se pueda volver a correr: un CHECK no se redefine solo.
-- ---------------------------------------------------------------------

alter table public.sugerencias_item
  add column if not exists tipo text not null default 'item';

alter table public.sugerencias_item
  drop constraint if exists sugerencias_item_tipo_check;
alter table public.sugerencias_item
  add  constraint sugerencias_item_tipo_check check (tipo in ('item','oficio'));

alter table public.sugerencias_item
  drop constraint if exists sugerencias_item_origen_check;
alter table public.sugerencias_item
  add  constraint sugerencias_item_origen_check
  check (origen in ('solicitante','ofertador','aliado','proveedor'));

comment on column public.sugerencias_item.tipo is
  'Qué se está proponiendo: un ítem del catálogo de insumos o un oficio del directorio de servicios. Una sola cola y un solo panel de administración para las dos cosas.';

-- ---------------------------------------------------------------------
-- 4. `proveedores`
--
-- Dos dueños posibles y SOLO UNO a la vez:
--   · `perfil_id`  → tiene cuenta de Google, como cualquier ofertador.
--   · `token_hash` → no la tiene, y lo dio de alta la fundación.
--
-- Ese token no es comodidad. Es la puerta de habeas data de alguien que
-- no tiene cuenta: con él ve, corrige y borra su ficha sin pedirle
-- permiso a la organización que lo registró. Sin él, el alta asistida
-- sería la fundación siendo dueña de los datos de otra persona.
--
-- `organizacion_id` en SET NULL, igual que `solicitudes.organizacion_id`:
-- si la fundación deja de operar, el proveedor no pierde su ficha.
-- ---------------------------------------------------------------------

create table if not exists public.proveedores (
  id                  uuid primary key default gen_random_uuid(),
  perfil_id           uuid unique references public.perfiles(id) on delete cascade,
  organizacion_id     uuid references public.organizaciones(id) on delete set null,
  token_hash          text unique,
  nombre_visible      text not null check (char_length(nombre_visible) between 3 and 60),
  tipo                text not null check (tipo in ('persona','microempresa')),
  -- Público y a propósito: es la razón de ser del módulo. Requiere
  -- acepto_publicacion = true y su autorizacion_version.
  telefono            text not null check (telefono ~ '^[0-9+()\- ]{7,20}$'),
  -- Regla V: nace en false y solo lo mueve una persona (S3).
  telefono_verificado boolean not null default false,
  verificado_at       timestamptz,
  verificado_por      uuid references auth.users(id) on delete set null,
  municipio           text not null references public.municipios(codigo_dane),
  zona_id             uuid references public.zonas(id) on delete set null,
  zona_texto          text check (char_length(zona_texto) between 2 and 60),
  modalidad           text[] not null default '{}',   -- domicilio | local | remoto
  dias                text[] not null default '{}',   -- lun..dom
  franjas             text[] not null default '{}',   -- manana | tarde | noche
  medios_pago         text[] not null default '{}',   -- efectivo | nequi | daviplata
  descripcion         text check (char_length(descripcion) <= 300),
  acepto_publicacion  boolean not null default false,
  -- Qué texto exacto aceptó. Importa más aquí que en ningún otro sitio
  -- del proyecto: el dato no caduca, así que dentro de un año hay que
  -- poder decirlo.
  autorizacion_version text not null check (char_length(trim(autorizacion_version)) between 3 and 60),
  autorizacion_at     timestamptz not null default now(),
  alta_asistida       boolean not null default false,
  suspendido          boolean not null default false,
  creado_at           timestamptz not null default now(),
  actualizado_at      timestamptz not null default now(),
  es_prueba           boolean not null default false,
  constraint proveedores_tiene_dueno
    check (num_nonnulls(perfil_id, token_hash) = 1),
  constraint proveedores_asistida_con_organizacion
    check (not alta_asistida or organizacion_id is not null),
  constraint proveedores_una_zona
    check (num_nonnulls(zona_id, zona_texto) <= 1)
);

comment on table public.proveedores is
  'Directorio del rebusque (PLAN-V3). Responsable del tratamiento: la fundación aliada; AquíVe es encargada. Datos públicos por finalidad declarada y PERMANENTES: esta tabla no la toca ningún job de expiración. Se borra a petición del titular o por moderación.';

comment on column public.proveedores.token_hash is
  'sha256 del token de alta asistida. Es la puerta de habeas data de quien no tiene cuenta de Google: con él ve, corrige y borra su ficha sin pasar por la organización que lo registró.';

comment on column public.proveedores.telefono is
  'Dato personal deliberadamente público, igual que perfiles.contacto_publico. Requiere acepto_publicacion = true.';

create index if not exists idx_proveedores_municipio
  on public.proveedores(municipio) where not suspendido and acepto_publicacion;

create index if not exists idx_proveedores_organizacion
  on public.proveedores(organizacion_id) where organizacion_id is not null;

-- ---------------------------------------------------------------------
-- 5. `proveedor_oficios` — qué hace y por cuánto
--
-- El precio no es campo libre (regla 2): modo de lista, valor «desde»
-- numérico y unidad de lista. Un campo libre en un perfil público es por
-- donde se cuela el segundo teléfono, y además un precio comparable
-- sirve para ordenar y filtrar y uno en prosa no.
-- ---------------------------------------------------------------------

create table if not exists public.proveedor_oficios (
  proveedor_id uuid not null references public.proveedores(id) on delete cascade,
  oficio_id    text not null references public.catalogo_oficios(id),
  modo         text not null check (modo in ('gratis','aporte','solidario','normal')),
  precio_desde numeric(10,0) check (precio_desde is null
                 or (precio_desde >= 0 and precio_desde <= 99999999)),
  unidad       text check (unidad in
                 ('hora','trabajo','dia','prenda','viaje','plato','unidad')),
  primary key (proveedor_id, oficio_id),
  constraint precio_solo_si_cobra
    check (modo in ('solidario','normal') or precio_desde is null),
  constraint precio_con_unidad
    check (precio_desde is null or unidad is not null)
);

create index if not exists idx_proveedor_oficios_oficio
  on public.proveedor_oficios(oficio_id);

-- ---------------------------------------------------------------------
-- 6. `referencias` — regla U
--
-- Lo más delicado del módulo: datos personales de alguien que NO está
-- usando la plataforma, recogidos apoyándose en la palabra de un tercero.
--
-- Va cifrada con las mismas herramientas de la Fase E —misma llave del
-- Vault, mismo pepper— y con su propia bitácora. Tabla aparte y no
-- `identidades` porque una referencia no entrega documento y allá el
-- documento es NOT NULL con CHECK.
--
-- Lo público es un número: cuántas referencias confirmadas hay. Nunca
-- quién es, nunca cuántas se rechazaron.
-- ---------------------------------------------------------------------

create table if not exists public.referencias (
  id                     uuid primary key default gen_random_uuid(),
  proveedor_id           uuid not null references public.proveedores(id) on delete cascade,
  nombre_cifrado         bytea not null,
  telefono_cifrado       bytea not null,
  telefono_hash          text  not null,
  oficio_id              text references public.catalogo_oficios(id),
  -- El proveedor declara haber obtenido la autorización de esta persona.
  -- Sin versión y sin fecha no hay nada que enseñar si la persona
  -- reclama, así que las dos son NOT NULL.
  consentimiento_version text not null check (char_length(trim(consentimiento_version)) between 3 and 60),
  consentimiento_at      timestamptz not null default now(),
  estado                 text not null default 'pendiente'
                           check (estado in ('pendiente','confirmada','no_contesta','rechazada')),
  revisada_por           uuid references auth.users(id) on delete set null,
  revisada_at            timestamptz,
  creada_at              timestamptz not null default now(),
  es_prueba              boolean not null default false
);

comment on table public.referencias is
  'CIFRADA. Regla U de PLAN-V3: datos de un tercero que no usa la plataforma. Tabla revocada entera, cero políticas, ninguna vista pública la toca. La única puerta son las RPC de la Fase S4, y la que descifra escribe bitácora ANTES de devolver.';

create index if not exists idx_referencias_proveedor
  on public.referencias(proveedor_id, estado);

-- La bitácora que SOBREVIVE a lo que registra. Mismo criterio que
-- `accesos_identidad`: SET NULL con copia en texto al lado, para que la
-- fila siga diciendo algo cuando la referencia ya no exista.
create table if not exists public.accesos_referencia (
  id             uuid primary key default gen_random_uuid(),
  referencia_id  uuid references public.referencias(id) on delete set null,
  referencia_ref text not null,
  leida_por      uuid references auth.users(id) on delete set null,
  lector_ref     text not null,
  rol_lector     text not null check (rol_lector in ('admin','aliado')),
  motivo         text not null check (char_length(trim(motivo)) between 5 and 200),
  leida_at       timestamptz not null default now(),
  es_prueba      boolean not null default false
);

comment on table public.accesos_referencia is
  'Regla U: cada lectura de una referencia deja rastro, y el rastro sobrevive al borrado de la referencia. Sin PII. Nadie tiene UPDATE ni DELETE sobre esta tabla, ni siquiera el administrador.';

create index if not exists idx_accesos_referencia
  on public.accesos_referencia(referencia_id, leida_at desc);

-- ---------------------------------------------------------------------
-- 7. `solicitudes_servicio` — el lado de la demanda
--
-- Regla 1 entera. Ni una columna que identifique a nadie: quien necesita
-- un servicio publica QUÉ necesita, no quién es. Token portador, como las
-- solicitudes de emergencia.
--
-- 15 días y no 72 horas: conseguir una modista no es conseguir agua.
-- ---------------------------------------------------------------------

create table if not exists public.solicitudes_servicio (
  id             uuid primary key default gen_random_uuid(),
  codigo         text not null unique,
  token_hash     text not null,
  oficio_id      text not null references public.catalogo_oficios(id),
  municipio      text not null references public.municipios(codigo_dane),
  zona_id        uuid references public.zonas(id) on delete set null,
  zona_texto     text check (char_length(zona_texto) between 2 and 60),
  urgencia       text not null check (urgencia in ('hoy','esta_semana','sin_prisa')),
  -- Enruta lo que ve quien pide, poniendo primero los modos gratis y
  -- aporte. NO es un filtro para proveedores: un tablero listable por
  -- esta columna sería un directorio de a quién le alcanza menos, y eso
  -- es justo lo que la regla 1 existe para impedir.
  capacidad_pago text not null check (capacidad_pago in
                   ('puedo_pagar','pago_poco','no_puedo_pagar')),
  nota           text check (char_length(nota) <= 140),
  estado         text not null default 'abierta' check (estado in ('abierta','resuelta')),
  creada_at      timestamptz not null default now(),
  expira_at      timestamptz not null default now() + interval '15 days',
  es_prueba      boolean not null default false,
  constraint solicitudes_servicio_una_zona
    check (num_nonnulls(zona_id, zona_texto) <= 1)
);

comment on table public.solicitudes_servicio is
  'Regla 1 completa: describe un servicio que hace falta, no a una persona. Sin nombre, sin teléfono, sin dirección exacta, sin composición del hogar. Borrado duro a los 15 días, renovable.';

comment on column public.solicitudes_servicio.capacidad_pago is
  'Ordena lo que ve quien pide. Nunca se expone como filtro del lado del proveedor ni sale en ninguna vista pública que se pueda listar por él.';

create index if not exists idx_solicitudes_servicio_vigentes
  on public.solicitudes_servicio(municipio, oficio_id)
  where estado = 'abierta';

create table if not exists public.respuestas_servicio (
  id           uuid primary key default gen_random_uuid(),
  solicitud_id uuid not null references public.solicitudes_servicio(id) on delete cascade,
  proveedor_id uuid not null references public.proveedores(id) on delete cascade,
  -- Pasa por contiene_pii en la RPC: el contacto del proveedor ya está en
  -- su ficha, repetirlo aquí solo abre un hueco.
  mensaje      text not null check (char_length(mensaje) between 10 and 200),
  creada_at    timestamptz not null default now(),
  unique (solicitud_id, proveedor_id)
);

-- ---------------------------------------------------------------------
-- 8. Confianza — regla T
--
-- El proveedor genera un código por trabajo y se lo da al cliente. Quien
-- tiene el código confirma y reseña, una sola vez, sin cuenta. Es el
-- mismo patrón de token portador de las solicitudes, y es lo que hace
-- que la reputación cueste un servicio y no un clic.
--
-- El código NO va en ninguna URL (regla 6): se escribe a mano en
-- /servicios/confirmar. Por eso se guarda solo su hash.
-- ---------------------------------------------------------------------

create table if not exists public.servicios_prestados (
  id            uuid primary key default gen_random_uuid(),
  proveedor_id  uuid not null references public.proveedores(id) on delete cascade,
  oficio_id     text references public.catalogo_oficios(id),
  codigo_hash   text not null unique,
  confirmado_at timestamptz,
  creado_at     timestamptz not null default now(),
  expira_at     timestamptz not null default now() + interval '30 days',
  es_prueba     boolean not null default false
);

comment on table public.servicios_prestados is
  'Regla T. Un código sin usar es basura a los 30 días y lo borra expirar_servicios(). Uno confirmado se queda mientras exista la ficha, porque es lo que sostiene la reseña.';

create table if not exists public.resenas (
  id           uuid primary key default gen_random_uuid(),
  -- UNIQUE: un código, una reseña. En la base, no en la interfaz.
  servicio_id  uuid not null unique references public.servicios_prestados(id) on delete cascade,
  -- Copia denormalizada para poder indexar y agregar sin un join más.
  -- No puede desincronizarse: ambas cuelgan del mismo proveedor y las dos
  -- se van en cascada con él.
  proveedor_id uuid not null references public.proveedores(id) on delete cascade,
  -- Escala de 3 y no de 5: se toca de pie, con prisa y en un teléfono
  -- viejo. Mal / bien / muy bien se acierta sin mirar.
  cumplimiento smallint not null check (cumplimiento between 1 and 3),
  trato        smallint not null check (trato between 1 and 3),
  puntualidad  smallint not null check (puntualidad between 1 and 3),
  comentario   text check (char_length(comentario) <= 140),
  replica      text check (char_length(replica) <= 140),
  replica_at   timestamptz,
  -- Moderación reversible, NO borrado lógico: una reseña no es un dato
  -- personal de quien la escribió. Un reporte por extorsión termina en
  -- DELETE de verdad.
  oculta       boolean not null default false,
  creada_at    timestamptz not null default now(),
  es_prueba    boolean not null default false
);

create index if not exists idx_resenas_proveedor
  on public.resenas(proveedor_id) where not oculta;

-- ---------------------------------------------------------------------
-- 9. Moderación y métricas
--
-- Se extiende lo que ya existe. Los dos motivos nuevos son los dos
-- riesgos que el documento fuente nombra en su §7 y que hoy no tenían
-- dónde reportarse.
-- ---------------------------------------------------------------------

alter table public.reportes drop constraint if exists reportes_tipo_objeto_check;
alter table public.reportes add  constraint reportes_tipo_objeto_check
  check (tipo_objeto in ('solicitud','respuesta','perfil','entidad','proveedor','resena'));

alter table public.reportes drop constraint if exists reportes_motivo_check;
alter table public.reportes add  constraint reportes_motivo_check
  check (motivo in ('datos_personales','estafa','contenido_ofensivo',
                    'informacion_falsa','menor_de_edad',
                    'extorsion_resena','discriminacion','otro'));

-- Sin llave foránea, igual que `metricas`: la fila madre no va a existir
-- cuando esto se consulte. Por eso `es_prueba` es la única forma de
-- limpiar después.
create table if not exists public.metricas_servicio (
  id                    bigserial primary key,
  municipio             text not null,
  oficio                text not null,
  grupo                 text not null,
  hubo_respuesta        boolean not null,
  hubo_confirmacion     boolean not null default false,
  horas_hasta_respuesta numeric(6,1),
  es_prueba             boolean not null default false,
  creada_at             timestamptz not null default now()
);

comment on table public.metricas_servicio is
  'Lo único que sobrevive al borrado de una solicitud de servicio. Sin texto, sin zona, sin identificadores. Publicable como dato abierto.';

-- ---------------------------------------------------------------------
-- 10. RLS
--
-- Tres regímenes distintos, y la diferencia importa:
--
--   · Catálogos (`zonas`, `catalogo_oficios`): lectura pública directa,
--     como `municipios` y `catalogo_servicios`. No son datos de nadie.
--   · Tablas del directorio: revocadas, y lo público sale por vistas de
--     `postgres` sin `security_invoker`. Mismo mecanismo que
--     `servidores_publicos`.
--   · `referencias` y `accesos_referencia`: revocadas y CERO políticas.
--     Un select sobre `referencias`, aunque devolviera solo bytea, sería
--     un volcado del material cifrado.
-- ---------------------------------------------------------------------

alter table public.zonas                enable row level security;
alter table public.catalogo_oficios     enable row level security;
alter table public.proveedores          enable row level security;
alter table public.proveedor_oficios    enable row level security;
alter table public.referencias          enable row level security;
alter table public.accesos_referencia   enable row level security;
alter table public.solicitudes_servicio enable row level security;
alter table public.respuestas_servicio  enable row level security;
alter table public.servicios_prestados  enable row level security;
alter table public.resenas              enable row level security;
alter table public.metricas_servicio    enable row level security;

drop policy if exists "zonas lectura publica" on public.zonas;
create policy "zonas lectura publica" on public.zonas
  for select to public using (activa = true);

drop policy if exists "oficios lectura publica" on public.catalogo_oficios;
create policy "oficios lectura publica" on public.catalogo_oficios
  for select to public using (activo = true);

drop policy if exists "metricas servicio lectura publica" on public.metricas_servicio;
create policy "metricas servicio lectura publica" on public.metricas_servicio
  for select to public using (true);

revoke all on public.proveedores          from anon, authenticated;
revoke all on public.proveedor_oficios    from anon, authenticated;
revoke all on public.referencias          from anon, authenticated;
revoke all on public.accesos_referencia   from anon, authenticated;
revoke all on public.solicitudes_servicio from anon, authenticated;
revoke all on public.respuestas_servicio  from anon, authenticated;
revoke all on public.servicios_prestados  from anon, authenticated;
revoke all on public.resenas              from anon, authenticated;

-- El admin necesita ver también lo suspendido y lo oculto, que es
-- justamente lo que las vistas públicas esconden. EXISTS a mano contra
-- `administradores`: `es_admin()` tiene EXECUTE revocado y dentro de una
-- política falla con «permission denied» para todo el mundo.
drop policy if exists "admin lee proveedores" on public.proveedores;
create policy "admin lee proveedores" on public.proveedores
  for select to authenticated
  using (exists (select 1 from public.administradores a
                  where a.user_id = (select auth.uid())));

drop policy if exists "admin lee resenas" on public.resenas;
create policy "admin lee resenas" on public.resenas
  for select to authenticated
  using (exists (select 1 from public.administradores a
                  where a.user_id = (select auth.uid())));

-- ---------------------------------------------------------------------
-- 11. Vistas públicas
--
-- ⚠ SIN `security_invoker = on`, igual que `entidades_publicas` y
-- `servidores_publicos`. La vista es de `postgres` y evalúa el select con
-- sus permisos, que es lo que la hace atravesar el RLS de la tabla. Si
-- alguien se lo pone «por seguridad» —el linter de Supabase lo sugiere—
-- el directorio queda VACÍO en producción.
-- ---------------------------------------------------------------------

-- Regla S vive aquí. `proveedor_oficios_publicos` es la capa que esconde
-- los oficios de riesgo alto de quien no está verificado y sin
-- referencia; todo lo demás se construye encima, para que no haya dos
-- sitios donde acordarse de filtrar.
create or replace view public.proveedor_oficios_publicos as
select po.proveedor_id, po.oficio_id, po.modo, po.precio_desde, po.unidad,
       o.nombre as oficio_nombre, o.grupo, o.riesgo
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

grant select on public.proveedor_oficios_publicos to anon, authenticated;

comment on view public.proveedor_oficios_publicos is
  'Regla S de PLAN-V3: un oficio de riesgo alto no se publica si el proveedor no tiene teléfono verificado Y una referencia confirmada. Es la única capa donde se aplica ese filtro, a propósito: si se duplica, un día una de las dos copias se olvida.';

-- Un proveedor sin ningún oficio publicable no aparece en el directorio.
-- Es la consecuencia deliberada de la regla S: quien solo ofrece cuidado
-- de niños y no está verificado no sale, en vez de salir sin ese oficio y
-- parecer que ofrece otra cosa.
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
       coalesce(res.total, 0) as total_resenas
from public.proveedores p
left join public.zonas z on z.id = p.zona_id
join lateral (
  select array_agg(distinct pop.oficio_id) as oficios,
         array_agg(distinct pop.grupo)     as grupos
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

comment on view public.proveedores_publicos is
  'Lo que ve cualquiera, sin cuenta. Expone el teléfono porque esa es la finalidad del módulo y está consentida. NO expone: token_hash, organizacion_id, alta_asistida, es_prueba, ni nada de referencias más allá de cuántas hay confirmadas.';

create or replace view public.resenas_publicas as
select r.id, r.proveedor_id, r.cumplimiento, r.trato, r.puntualidad,
       r.comentario, r.replica, r.replica_at, r.creada_at
from public.resenas r
join public.proveedores p on p.id = r.proveedor_id
where not r.oculta and not p.suspendido and p.acepto_publicacion;

grant select on public.resenas_publicas to anon, authenticated;

create or replace view public.solicitudes_servicio_publicas as
select s.id, s.codigo, s.oficio_id, o.nombre as oficio_nombre, o.grupo,
       s.municipio, s.zona_id, z.nombre as zona_nombre, s.zona_texto,
       s.urgencia, s.capacidad_pago, s.nota, s.creada_at, s.expira_at,
       (select count(*) from public.respuestas_servicio rs
         where rs.solicitud_id = s.id) as num_respuestas
from public.solicitudes_servicio s
join public.catalogo_oficios o on o.id = s.oficio_id
left join public.zonas z on z.id = s.zona_id
where s.estado = 'abierta' and s.expira_at > now();

grant select on public.solicitudes_servicio_publicas to anon, authenticated;

-- Listas estrechas para los desplegables, como municipios_con_servidores.
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

-- ---------------------------------------------------------------------
-- 12. Expiración
--
-- Dos cosas, y ninguna toca la ficha del proveedor: esa no expira, se
-- borra a petición o por moderación.
-- ---------------------------------------------------------------------

create or replace function public.expirar_servicios()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- 1. Métrica anónima ANTES del borrado, que es cuando todavía hay de
  --    dónde sacarla. Mismo orden que expirar_solicitudes().
  insert into public.metricas_servicio (
    municipio, oficio, grupo, hubo_respuesta, hubo_confirmacion,
    horas_hasta_respuesta, es_prueba
  )
  select s.municipio,
         s.oficio_id,
         o.grupo,
         exists (select 1 from public.respuestas_servicio r
                  where r.solicitud_id = s.id),
         s.estado = 'resuelta',
         (select round(extract(epoch from (min(r.creada_at) - s.creada_at)) / 3600.0, 1)
            from public.respuestas_servicio r
           where r.solicitud_id = s.id),
         s.es_prueba
  from public.solicitudes_servicio s
  join public.catalogo_oficios o on o.id = s.oficio_id
  where s.expira_at <= now();

  delete from public.solicitudes_servicio where expira_at <= now();

  -- 2. Un código que nadie usó en 30 días es basura. Los confirmados no
  --    se tocan: sostienen una reseña.
  delete from public.servicios_prestados
   where confirmado_at is null and expira_at <= now();
end;
$$;

revoke execute on function public.expirar_servicios() from public, anon, authenticated;

comment on function public.expirar_servicios() is
  'Solo lo llama pg_cron. Borrado duro (regla 4). No toca `proveedores`: esa tabla no expira.';

select cron.schedule(
  'expirar-servicios',
  '15 * * * *',
  $$select public.expirar_servicios();$$
)
where not exists (
  select 1 from cron.job where jobname = 'expirar-servicios'
);


-- =====================================================================
-- v3 · Fase S2 — Alta y edición del proveedor
--
-- Volcado de `supabase/migraciones/v3-s2-proveedor.sql`.
--
-- Ojo: su §7 vuelve a definir `proveedores_publicos`, que la Fase S1 ya
-- creó unas líneas más arriba, para agregarle la columna `modos`. En una
-- instalación nueva se ejecutan las dos y manda la segunda, que es la
-- buena. No se fusionaron a mano para que este archivo siga siendo el
-- volcado literal de las migraciones y no una tercera versión.
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


-- =====================================================================
-- v3 · Fase S3 — Alta asistida y verificación del teléfono
--
-- Volcado de `supabase/migraciones/v3-s3-alta-asistida.sql`.
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


-- =====================================================================
-- v3 · Fase S4 — Referencias cifradas
--
-- Volcado de `supabase/migraciones/v3-s4-referencias.sql`.
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


-- =====================================================================
-- v3 · Fase S5 — El lado de la demanda
--
-- Volcado de `supabase/migraciones/v3-s5-demanda.sql`.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Publicar
--
-- Devuelve el código, como `crear_solicitud`. El token entra en claro y
-- se guarda hasheado: esta función nunca lo devuelve, porque quien la
-- llama ya lo tiene.
-- ---------------------------------------------------------------------

create or replace function public.crear_solicitud_servicio(
  p_oficio_id      text,
  p_municipio      text,
  p_zona_id        uuid,
  p_zona_texto     text,
  p_urgencia       text,
  p_capacidad_pago text,
  p_nota           text,
  p_token          text
)
returns table (solicitud_id uuid, codigo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_codigo text;
  v_zona   text := nullif(trim(coalesce(p_zona_texto, '')), '');
  v_nota   text := nullif(trim(coalesce(p_nota, '')), '');
  v_id     uuid;
  v_intento integer := 0;
begin
  if not exists (select 1 from public.catalogo_oficios c
                  where c.id = p_oficio_id and c.activo) then
    raise exception 'Oficio no válido';
  end if;

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
    if char_length(v_zona) < 2 or char_length(v_zona) > 60 then
      raise exception 'La zona debe tener entre 2 y 60 caracteres';
    end if;
    if public.contiene_pii(v_zona) then
      raise exception 'La zona no puede llevar teléfonos ni correos';
    end if;
  end if;

  if p_urgencia not in ('hoy','esta_semana','sin_prisa') then
    raise exception 'Urgencia inválida';
  end if;
  if p_capacidad_pago not in ('puedo_pagar','pago_poco','no_puedo_pagar') then
    raise exception 'Opción de pago inválida';
  end if;

  if v_nota is not null then
    if char_length(v_nota) > 140 then
      raise exception 'La nota no puede pasar de 140 caracteres';
    end if;
    -- Regla 1 y regla 2: es el único texto libre de esta tabla y es por
    -- donde se colaría un teléfono, que es justo lo que no se guarda de
    -- quien pide.
    if public.contiene_pii(v_nota) then
      raise exception 'La nota no puede llevar teléfonos ni correos. Quien te responda te va a dejar el suyo.';
    end if;
  end if;

  if coalesce(char_length(trim(p_token)), 0) < 20 then
    raise exception 'Token inválido';
  end if;

  -- Código corto y legible, como el de las solicitudes de emergencia. Se
  -- reintenta ante una colisión en vez de confiar en la suerte: cuatro
  -- caracteres son 1,3 millones de combinaciones, y con unos miles de
  -- filas vivas el cumpleaños pega.
  loop
    v_intento := v_intento + 1;
    v_codigo := upper(substring(encode(extensions.gen_random_bytes(8), 'hex') from 1 for 4));
    exit when not exists (
      select 1 from public.solicitudes_servicio s where s.codigo = v_codigo);
    if v_intento > 20 then
      raise exception 'No se pudo generar el código';
    end if;
  end loop;

  insert into public.solicitudes_servicio (
    codigo, token_hash, oficio_id, municipio, zona_id, zona_texto,
    urgencia, capacidad_pago, nota)
  values (
    v_codigo,
    encode(extensions.digest(p_token, 'sha256'), 'hex'),
    p_oficio_id, p_municipio, p_zona_id, v_zona,
    p_urgencia, p_capacidad_pago, v_nota)
  returning id into v_id;

  return query select v_id, v_codigo;
end;
$$;

revoke execute on function public.crear_solicitud_servicio(
  text,text,uuid,text,text,text,text,text) from public, anon, authenticated;

comment on function public.crear_solicitud_servicio(
  text,text,uuid,text,text,text,text,text) is
  'La llama el servidor de Next con la llave de servicio, como crear_solicitud: el token lo genera allá. Sin grant a anon, para que el token no pueda entrar desde el navegador sin pasar por el Turnstile.';

-- ---------------------------------------------------------------------
-- 2. Leer la propia solicitud, con el token
--
-- Trae las respuestas con el contacto de quien respondió, que es lo
-- único que hace falta: quien pidió decide a quién escribir y lo hace
-- por fuera. La plataforma no sabe nada de esa conversación.
-- ---------------------------------------------------------------------

create or replace function public.leer_solicitud_servicio(p_token text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id,
    'codigo', s.codigo,
    'oficio_id', s.oficio_id,
    'oficio_nombre', c.nombre,
    'municipio', s.municipio,
    'zona_nombre', z.nombre,
    'zona_texto', s.zona_texto,
    'urgencia', s.urgencia,
    'capacidad_pago', s.capacidad_pago,
    'nota', s.nota,
    'estado', s.estado,
    'creada_at', s.creada_at,
    'expira_at', s.expira_at,
    'respuestas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id,
               'mensaje', r.mensaje,
               'creada_at', r.creada_at,
               'proveedor_id', p.id,
               'proveedor_nombre', p.nombre_visible,
               'telefono', p.telefono,
               'telefono_verificado', p.telefono_verificado,
               'servicios_confirmados', p.servicios_confirmados,
               'referencias_confirmadas', p.referencias_confirmadas
             ) order by r.creada_at desc)
      from public.respuestas_servicio r
      -- Contra la vista, no contra la tabla: si a quien respondió lo
      -- suspendieron después, su respuesta deja de mostrarse.
      join public.proveedores_publicos p on p.id = r.proveedor_id
      where r.solicitud_id = s.id), '[]'::jsonb)
  )
  from public.solicitudes_servicio s
  join public.catalogo_oficios c on c.id = s.oficio_id
  left join public.zonas z on z.id = s.zona_id
  where s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
$$;

grant execute on function public.leer_solicitud_servicio(text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3. Renovar, resolver, borrar
--
-- Las tres con el token y nada más. Borrar es DELETE real y deja su fila
-- anónima en `metricas_servicio`, igual que hace la expiración: si el
-- borrado manual no la dejara, resolver a mano borraría la estadística
-- de lo que sí funcionó.
-- ---------------------------------------------------------------------

create or replace function public.gestionar_solicitud_servicio(
  p_token  text,
  p_accion text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sol public.solicitudes_servicio;
begin
  if p_accion not in ('renovar','resolver','borrar') then
    raise exception 'Acción inválida';
  end if;

  select * into v_sol from public.solicitudes_servicio
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  if not found then
    raise exception 'No encontramos esa solicitud';
  end if;

  if p_accion = 'renovar' then
    update public.solicitudes_servicio
       set expira_at = now() + interval '15 days'
     where id = v_sol.id;
    return jsonb_build_object('ok', true, 'expira_at', now() + interval '15 days');
  end if;

  if p_accion = 'resolver' then
    update public.solicitudes_servicio
       set estado = 'resuelta'
     where id = v_sol.id;
    return jsonb_build_object('ok', true, 'estado', 'resuelta');
  end if;

  insert into public.metricas_servicio (
    municipio, oficio, grupo, hubo_respuesta, hubo_confirmacion,
    horas_hasta_respuesta, es_prueba)
  select v_sol.municipio, v_sol.oficio_id, c.grupo,
         exists (select 1 from public.respuestas_servicio r
                  where r.solicitud_id = v_sol.id),
         v_sol.estado = 'resuelta',
         (select round(extract(epoch from (min(r.creada_at) - v_sol.creada_at)) / 3600.0, 1)
            from public.respuestas_servicio r where r.solicitud_id = v_sol.id),
         v_sol.es_prueba
  from public.catalogo_oficios c where c.id = v_sol.oficio_id;

  delete from public.solicitudes_servicio where id = v_sol.id;
  return jsonb_build_object('ok', true, 'borrada', true);
end;
$$;

grant execute on function public.gestionar_solicitud_servicio(text,text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4. Responder
--
-- Solo un proveedor publicado, y una sola vez por solicitud. El mensaje
-- pasa por `contiene_pii`: su teléfono ya está en su ficha y en la
-- pantalla de quien pidió, así que repetirlo aquí no aporta y sí abre un
-- hueco por donde meter otra cosa.
-- ---------------------------------------------------------------------

create or replace function public.responder_servicio(
  p_solicitud_id uuid,
  p_mensaje      text,
  p_token        text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prov uuid := public.proveedor_del_llamante(p_token);
  v_msg  text := trim(coalesce(p_mensaje, ''));
begin
  if v_prov is null then
    raise exception 'Necesitas una ficha en el directorio para responder';
  end if;

  -- Contra la vista: quien está suspendido, o a quien la regla S le
  -- escondió todos sus oficios, no aparece en el directorio y tampoco
  -- puede responder. Sería la puerta de atrás al mismo sitio.
  if not exists (select 1 from public.proveedores_publicos p where p.id = v_prov) then
    raise exception 'Tu ficha no está publicada, así que todavía no puedes responder';
  end if;

  if not exists (select 1 from public.solicitudes_servicio s
                  where s.id = p_solicitud_id
                    and s.estado = 'abierta'
                    and s.expira_at > now()) then
    raise exception 'Esa solicitud ya no está abierta';
  end if;

  if char_length(v_msg) < 10 or char_length(v_msg) > 200 then
    raise exception 'El mensaje debe tener entre 10 y 200 caracteres';
  end if;
  if public.contiene_pii(v_msg) then
    raise exception 'No pongas tu teléfono aquí: ya sale en tu ficha, y esa persona lo va a ver.';
  end if;

  insert into public.respuestas_servicio (solicitud_id, proveedor_id, mensaje)
  values (p_solicitud_id, v_prov, v_msg)
  on conflict (solicitud_id, proveedor_id) do update set
    mensaje = excluded.mensaje,
    creada_at = now();
end;
$$;

revoke execute on function public.responder_servicio(uuid,text,text) from public;
grant  execute on function public.responder_servicio(uuid,text,text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. El tablero, para quien ofrece
--
-- Ordenado por urgencia y por antigüedad. Trae si el proveedor que mira
-- ya respondió, para no ofrecerle un botón que va a rebotar.
--
-- `capacidad_pago` sale aquí porque quien ofrece necesita saber si le
-- están pidiendo trabajo gratis antes de escribir. Lo que NO existe es
-- un filtro por esa columna: un tablero listable por ahí sería un
-- directorio de a quién le alcanza menos.
-- ---------------------------------------------------------------------

create or replace function public.solicitudes_de_servicio(
  p_municipio text default null,
  p_oficio_id text default null,
  p_token     text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_prov uuid := public.proveedor_del_llamante(p_token);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'codigo', s.codigo,
      'oficio_id', s.oficio_id,
      'oficio_nombre', s.oficio_nombre,
      'grupo', s.grupo,
      'municipio', s.municipio,
      'zona_nombre', s.zona_nombre,
      'zona_texto', s.zona_texto,
      'urgencia', s.urgencia,
      'capacidad_pago', s.capacidad_pago,
      'nota', s.nota,
      'creada_at', s.creada_at,
      'num_respuestas', s.num_respuestas,
      'ya_respondi', v_prov is not null and exists (
        select 1 from public.respuestas_servicio r
         where r.solicitud_id = s.id and r.proveedor_id = v_prov)
    ) order by
        case s.urgencia when 'hoy' then 0 when 'esta_semana' then 1 else 2 end,
        s.creada_at desc)
    from public.solicitudes_servicio_publicas s
    where (p_municipio is null or s.municipio = p_municipio)
      and (p_oficio_id is null or s.oficio_id = p_oficio_id)
  ), '[]'::jsonb);
end;
$$;

grant execute on function public.solicitudes_de_servicio(text,text,text) to anon, authenticated;
