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
  creada_at       timestamptz not null default now(),
  cerrada_at      timestamptz,
  unique (solicitud_id, ofertador_id)
);

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
  s.flujo
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
    where o.perfil_id = p.id and o.disponible) as total_items
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
  p_token       text
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

  insert into public.solicitudes (codigo, token_hash, municipio, barrio, categoria, nota, es_prueba)
  values (v_codigo, encode(extensions.digest(p_token, 'sha256'), 'hex'),
          p_municipio, p_barrio, p_categoria, nullif(trim(p_nota), ''), v_es_prueba)
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
    'flujo', v_sol.flujo,
    -- El NOMBRE de la organización, nunca su identificador ni nada de la
    -- identidad: los datos que entregó no se le vuelven a mostrar.
    'organizacion', (select o.nombre from public.organizaciones o
                      where o.id = v_sol.organizacion_id),
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
  -- campos se descarta aquí, no se guarda «por si acaso». Nadie se declara
  -- aliado desde /registro; el tipo aparece al unirse a una organización, y
  -- esto existe para que un aliado pueda editar su nombre sin que la RPC lo
  -- rechace.
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
-- `aliado_en_municipio` devuelve UNA organización activa que cubra ese
-- municipio, con su nombre y su id, y nada más: ni cuántas hay, ni dónde
-- queda su acopio, ni cuánta gente tiene dentro. Devuelve una sola a
-- propósito — un desplegable de fundaciones convertiría una oferta en una
-- decisión de compras, y quien publica a las tres de la mañana no está
-- para elegir proveedor.
-- ---------------------------------------------------------------------

create or replace function public.aliado_en_municipio(p_municipio text)
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select jsonb_build_object('id', o.id, 'nombre', o.nombre)
    from public.organizaciones o
   where o.activa
     and p_municipio = any(o.municipios)
   order by o.creada_at
   limit 1;
$$;

grant execute on function public.aliado_en_municipio(text) to anon, authenticated;

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
        'municipio',     m.nombre,
        'barrio',        s.barrio,
        'soy_ofertador', c.ofertador_id = auth.uid(),
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
        'municipio',          m.nombre,
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
--      14 días desde que se publicaron. El techo existe para que una
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
     and s.creada_at > now() - interval '14 days'
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
    'municipio',   (select m.nombre from public.municipios m
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
               'municipio', m.nombre,
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
--   -- Auto-renovado: con hilo vivo y menos de 14 días, la fecha se mueve.
--   -- Con más de 14 días, no se mueve y el hilo queda cerrado.
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
