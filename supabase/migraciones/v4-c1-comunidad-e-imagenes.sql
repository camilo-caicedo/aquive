-- v4-c1 · Comunidad (pantallas 30 y 31) e imágenes.
--
-- ADR 0003, decisiones 2 y 3, aceptadas el 26 de agosto de 2026.
-- Idempotente.

-- ---------------------------------------------------------------------
-- 1. Imágenes
-- ---------------------------------------------------------------------
--
-- Tabla propia y no una columna en cada cosa que lleva foto: el recorrido
-- —cuarentena, reencodificado, cola de moderación, publicación— es el mismo
-- para todas, y repartirlo por columnas significaría repetir la cola de
-- moderación tantas veces como sitios acepten imagen.
--
-- `objeto_id` nace NULL a propósito. La foto se sube mientras se escribe la
-- publicación, antes de que la publicación exista; se enlaza al guardar. Las
-- que nunca se enlazan las barre el job de huérfanas.
--
-- `ruta` es la clave dentro del bucket, no una URL. La URL la arma quien
-- pinta, y así cambiar de proveedor de almacenamiento no obliga a reescribir
-- cada fila.

create table if not exists public.imagenes (
  id            uuid primary key default gen_random_uuid(),
  objeto_tipo   text not null check (objeto_tipo in ('muro', 'producto')),
  objeto_id     uuid,
  ruta          text not null unique,
  estado        text not null default 'en_cola'
                  check (estado in ('en_cola', 'aprobada', 'rechazada')),
  motivo        text,
  ancho         integer,
  alto          integer,
  bytes         integer,
  subida_at     timestamptz not null default now(),
  revisada_at   timestamptz,
  revisada_por  uuid references auth.users(id) on delete set null
);

create index if not exists idx_imagenes_cola
  on public.imagenes (estado, subida_at) where estado = 'en_cola';
create index if not exists idx_imagenes_objeto
  on public.imagenes (objeto_tipo, objeto_id) where objeto_id is not null;

comment on table public.imagenes is
  'Toda imagen del sitio pasa por aquí. Sube a `cuarentena`, se reencodifica con sharp —que descarta el EXIF, donde viven las coordenadas GPS de la foto— y solo al aprobarse se copia a `publico`. Regla de producto 8.';

comment on column public.imagenes.objeto_id is
  'NULL mientras se escribe la publicación. La foto se sube antes de que exista aquello a lo que pertenece; las que nunca se enlazan las barre el job de huérfanas.';

comment on column public.imagenes.estado is
  'Ninguna imagen se publica sin que una persona la mire. No es discrecional en un punto: una foto donde se identifique a un menor se rechaza, artículo 7 de la Ley 1581.';

-- ---------------------------------------------------------------------
-- 2. El muro, con sus dos caras
-- ---------------------------------------------------------------------
--
-- ⚠ La asimetría entre las dos caras es la regla de producto 4, y va en un
-- CHECK y no en la interfaz:
--
--   · `ofrece`  — alguien dona una cosa. Publica su nombre, así que hay
--                 consentimiento con su versión y su fecha.
--   · `necesita` — alguien pide. NO tiene cuenta, NO da su nombre, y entra
--                 después con el token, igual que una solicitud de insumos.
--
-- Confiar esa diferencia a que la pantalla se acuerde es exactamente cómo se
-- termina guardando el nombre de quien pidió.

create table if not exists public.publicaciones_muro (
  id            uuid primary key default gen_random_uuid(),
  cara          text not null check (cara in ('ofrece', 'necesita')),

  -- Solo la cara que ofrece
  perfil_id     uuid references public.perfiles(id) on delete cascade,
  autor_nombre  text,
  autorizacion_version text,
  autorizacion_at      timestamptz,

  -- Solo la cara que necesita
  token_hash    text,

  categoria     text not null,
  titulo        text not null check (char_length(titulo) between 3 and 140),
  detalle       text check (char_length(detalle) <= 300),
  municipio     text not null references public.municipios(codigo_dane),
  zona_id       uuid references public.zonas(id) on delete set null,

  estado        text not null default 'abierta'
                  check (estado in ('abierta', 'resuelta')),
  creada_at     timestamptz not null default now(),
  -- Quien ofrece la deja mientras quiera; quien necesita, 15 días.
  expira_at     timestamptz,
  es_prueba     boolean not null default false,

  constraint muro_ofrece_con_nombre check (
    cara <> 'ofrece'
    or (perfil_id is not null and autor_nombre is not null
        and autorizacion_version is not null)
  ),
  constraint muro_necesita_sin_datos check (
    cara <> 'necesita'
    or (token_hash is not null and perfil_id is null and autor_nombre is null)
  )
);

create index if not exists idx_muro_abierta
  on public.publicaciones_muro (cara, municipio, creada_at desc)
  where estado = 'abierta';

comment on table public.publicaciones_muro is
  'Las dos caras del muro. Quien OFRECE publica con nombre y consentimiento; quien NECESITA no deja rastro y vuelve con su token. La asimetría la sostienen dos CHECK, no la interfaz.';

comment on constraint muro_necesita_sin_datos on public.publicaciones_muro is
  'Regla de producto 4: quien pide publica sin cuenta y sin datos. Este CHECK es lo que impide que una pantalla futura guarde su nombre «solo esta vez».';

-- ---------------------------------------------------------------------
-- 3. Hecho en el barrio
-- ---------------------------------------------------------------------
--
-- Cuelga de `proveedores`, así que se borra con la ficha y hereda su
-- consentimiento de publicación: quien aparece aquí ya aceptó que su nombre
-- y su oficio sean públicos.
--
-- El precio es lo mismo que en los oficios —modo más «desde» más unidad— y
-- no un campo libre. Un campo libre en un precio público es por donde se
-- cuela un segundo teléfono (regla de producto 1).

create table if not exists public.productos (
  id            uuid primary key default gen_random_uuid(),
  proveedor_id  uuid not null references public.proveedores(id) on delete cascade,
  nombre        text not null check (char_length(nombre) between 2 and 140),
  detalle       text check (char_length(detalle) <= 300),
  modo          text not null default 'normal'
                  check (modo in ('gratis', 'aporte', 'solidario', 'normal')),
  precio_desde  numeric(12, 2),
  unidad        text check (unidad in ('unidad', 'libra', 'kilo', 'docena', 'plato', 'trabajo')),
  disponible    boolean not null default true,
  creado_at     timestamptz not null default now()
);

create index if not exists idx_productos_proveedor
  on public.productos (proveedor_id) where disponible;

comment on table public.productos is
  'Hecho en el barrio. AquíVe no vende nada y no cobra comisión: el precio es información y el acuerdo ocurre fuera (regla de producto 1). Cuelga de proveedores, así que se borra con la ficha.';

-- ---------------------------------------------------------------------
-- 4. Vistas públicas
-- ---------------------------------------------------------------------
--
-- Como todo el resto: la interfaz lee de la vista, nunca de la tabla, y el
-- filtro vive en un solo sitio.
--
-- La imagen sale SOLO si está aprobada. Si el filtro estuviera en cada
-- consulta, un día una copia se olvidaría — y aquí olvidarse significa
-- publicar una foto que nadie miró.

create or replace view public.muro_publico as
select
  m.id, m.cara, m.categoria, m.titulo, m.detalle,
  m.municipio, mu.nombre as municipio_nombre,
  m.zona_id, z.nombre as zona_nombre,
  -- Solo la cara que ofrece tiene nombre. La otra no lo tiene ni en la tabla.
  m.autor_nombre, m.creada_at,
  (select i.ruta from public.imagenes i
    where i.objeto_tipo = 'muro' and i.objeto_id = m.id and i.estado = 'aprobada'
    order by i.subida_at limit 1) as imagen
from public.publicaciones_muro m
join public.municipios mu on mu.codigo_dane = m.municipio
left join public.zonas z on z.id = m.zona_id
where m.estado = 'abierta'
  and (m.expira_at is null or m.expira_at > now());

grant select on public.muro_publico to anon, authenticated;

create or replace view public.productos_publicos as
select
  p.id, p.proveedor_id, pp.nombre_visible as proveedor_nombre,
  pp.municipio, pp.zona_nombre,
  p.nombre, p.detalle, p.modo, p.precio_desde, p.unidad, p.creado_at,
  (select i.ruta from public.imagenes i
    where i.objeto_tipo = 'producto' and i.objeto_id = p.id and i.estado = 'aprobada'
    order by i.subida_at limit 1) as imagen
from public.productos p
join public.proveedores_publicos pp on pp.id = p.proveedor_id
where p.disponible;

grant select on public.productos_publicos to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. Sin RLS: el acceso va por la capa de dominio
-- ---------------------------------------------------------------------

revoke all on public.imagenes from anon, authenticated;
revoke all on public.publicaciones_muro from anon, authenticated;
revoke all on public.productos from anon, authenticated;

alter table public.imagenes enable row level security;
alter table public.publicaciones_muro enable row level security;
alter table public.productos enable row level security;
