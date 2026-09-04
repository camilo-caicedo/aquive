-- v4-d1 · PQR (pantalla 38).
--
-- Peticiones, quejas, reclamos y sugerencias. Sin cuenta: quien escribe se
-- lleva un código de 32 bytes del que aquí solo queda el sha256, igual que
-- una solicitud de insumos o la cara «necesita» del muro.
--
-- Idempotente.

-- ---------------------------------------------------------------------
-- 1. El buzón
-- ---------------------------------------------------------------------
--
-- ⚠ Los dos campos libres pasan por `public.contiene_pii`, y va en CHECK y
-- no solo en el dominio (regla dura 2). Una PQR es justo el sitio donde a
-- alguien le parece razonable escribir «llámame al 300…», y donde eso se
-- guardaría para siempre porque una queja no expira sola.
--
-- No hay `estado = 'eliminada'` ni columna de borrado lógico: cuando una
-- PQR se cierra y se archiva, se hace `delete` (regla dura 4). Tampoco hay
-- TTL automático: a diferencia de una solicitud, una queja tiene plazo
-- legal de respuesta y borrarla sola a las 72 horas sería incumplirlo.
--
-- `token_hash` es único: es lo que permite encontrar la fila a partir del
-- código que la persona cita, sin que el código esté guardado en ninguna
-- parte.

create table if not exists public.pqr (
  id            uuid primary key default gen_random_uuid(),
  tipo          text not null
                  check (tipo in ('peticion', 'queja', 'reclamo', 'sugerencia')),
  asunto        text not null check (char_length(asunto) between 3 and 140),
  detalle       text not null check (char_length(detalle) between 10 and 1000),

  token_hash    text not null unique,

  estado        text not null default 'abierta'
                  check (estado in ('abierta', 'respondida')),
  respuesta     text check (char_length(respuesta) <= 2000),

  creada_at     timestamptz not null default now(),
  respondida_at timestamptz,

  constraint pqr_sin_pii check (
    not public.contiene_pii(asunto) and not public.contiene_pii(detalle)
  ),
  constraint pqr_respondida_con_respuesta check (
    estado <> 'respondida' or (respuesta is not null and respondida_at is not null)
  )
);

-- Lo que mira quien atiende: lo abierto, lo más viejo primero, porque el
-- plazo legal corre desde que se recibió.
create index if not exists idx_pqr_abiertas
  on public.pqr (creada_at) where estado = 'abierta';

comment on table public.pqr is
  'Peticiones, quejas, reclamos y sugerencias. Sin cuenta y sin un solo dato de quien escribe: 32 bytes de token, de los que aquí solo vive el sha256. Los plazos de respuesta son los de los artículos 14 y 15 de la Ley 1581 — 10 días hábiles una consulta, 15 un reclamo — y por eso esta tabla no tiene TTL: borrarla sola sería incumplirlos.';

comment on constraint pqr_sin_pii on public.pqr is
  'Regla dura 2. Los dos campos libres son texto que una persona escribe con prisa y enfadada, que es cuando se escribe un teléfono. El filtro está también en el dominio; este CHECK es lo que impide que una pantalla futura se lo salte.';

comment on column public.pqr.token_hash is
  'sha256 del código que se le mostró una vez a quien escribió. El código no está aquí: quien atiende encuentra la fila hasheando el que la persona cita.';

-- ---------------------------------------------------------------------
-- 2. Sin RLS: el acceso va por la capa de dominio
-- ---------------------------------------------------------------------

revoke all on public.pqr from anon, authenticated;

alter table public.pqr enable row level security;
