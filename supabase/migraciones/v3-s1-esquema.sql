-- =====================================================================
-- v3 · Fase S1 — Esquema del módulo de Servicios
--
-- 🔴 Esta migración trae al proyecto la primera base de datos personales
-- que NO CADUCA. Todo lo anterior se borraba solo: las solicitudes a las
-- 72 horas, las identidades con ellas. Una ficha de proveedor permanece
-- hasta que su titular la borre, y eso cambia el análisis jurídico
-- entero — el argumento de «son datos efímeros» deja de aplicar.
--
-- Antes de que exista la primera fila real en `proveedores` tienen que
-- estar los papeles de PLAN-V3 §7: contrato de encargo firmado con la
-- fundación (`docs/legal/CONTRATO-SERVICIOS.md`), registro en el RNBD a
-- nombre de ella, canal de habeas data y el NIT y el correo puestos en
-- `src/lib/config.ts`, que hoy están en [PENDIENTE].
--
-- Crear las tablas no es empezar a recolectar. La recolección empieza en
-- la Fase S2, cuando exista la pantalla de alta.
--
-- Reglas que implementa (PLAN-V3 §2):
--   1 · Quien pide un servicio sigue sin dejar datos. `solicitudes_
--       servicio` no tiene una sola columna que identifique a nadie.
--   2 · Cuatro campos libres en todo el módulo, todos con tope y filtro.
--       El precio NO es campo libre: modo, valor «desde» y unidad.
--   4 · Dos relojes, los dos terminan en DELETE real.
--   S · El riesgo del oficio manda sobre la visibilidad. Los oficios de
--       riesgo alto no se publican sin teléfono verificado Y referencia
--       confirmada. Va en la vista, no en la interfaz.
--   T · Solo reseña quien tiene un código de servicio. `unique` sobre
--       `servicio_id`, no una validación de pantalla.
--   U · Una referencia es PII de un tercero ausente: cifrada, nunca
--       pública, con rastro de cada lectura que la sobrevive.
--   V · Nada nace verificado.
--
-- Sin interfaz y sin RPC. Esta migración crea tablas, vistas y el job de
-- expiración; las funciones de escritura llegan en S2 y siguientes.
--
-- Depende de `v2-e1-identidades.sql` por `cifrar_texto`, `hash_telefono`
-- y `normalizar_telefono`. No los redefine.
--
-- Idempotente. Se puede volver a correr.
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
  medios_pago         text[] not null default '{}',   -- ver medios_pago_validos()
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
