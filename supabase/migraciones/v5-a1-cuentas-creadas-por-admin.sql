-- ---------------------------------------------------------------------
-- La cuenta que crea un admin (ADR 0006)
-- ---------------------------------------------------------------------
--
-- Desde el ADR 0006 todo exige cuenta. Buena parte del rebusque no tiene
-- cuenta de Google, así que sin esta puerta el cambio los deja fuera — y
-- son justo el público que la aplicación busca.
--
-- El admin crea un usuario de verdad en `auth.users`, con un identificador
-- SINTÉTICO. No el correo de la persona: ese se sigue sin guardar, igual
-- que con Google. Y le entrega un código de acceso en mano o por WhatsApp.
--
-- ⚠ Ese código es, en la práctica, una contraseña escrita en un papel. Es
-- una decisión consciente y con su motivo: quien no tiene correo tampoco
-- tiene cómo recuperar una cuenta, y un enlace que caduca en una hora deja
-- fuera a quien lo recibió el martes y vuelve el jueves. Lo que se hace en
-- vez de caducarlo:
--
--   · Se guarda solo el `sha256`, nunca el código.
--   · Va en el path, jamás en query string (regla de interfaz 9).
--   · Hay como mucho UNO activo por persona: regenerar invalida el
--     anterior, y ese es el botón que usa el admin cuando alguien pierde
--     el papel o se lo quitan.
--   · Cada uso queda con su fecha, así que se ve si alguien más entró.

create table if not exists public.codigos_acceso (
  perfil_id    uuid primary key references public.perfiles(id) on delete cascade,
  codigo_hash  text not null unique,
  creado_at    timestamptz not null default now(),
  -- SET NULL y no CASCADE: que un admin se vaya no puede tumbar la puerta
  -- de otra persona.
  creado_por   uuid references auth.users(id) on delete set null,
  -- La ÚLTIMA vez que se usó, no un consumo: el código sigue sirviendo.
  usado_at     timestamptz
);

comment on table public.codigos_acceso is
  'La puerta de quien no tiene cuenta de Google (ADR 0006). Uno activo por persona: la llave primaria es el perfil, así que regenerar reemplaza. Se guarda solo el sha256.';

comment on column public.codigos_acceso.usado_at is
  'Última entrada, no consumo. Sirve para que un admin vea si el código sigue en uso antes de regenerarlo, y para notar una entrada que su dueño no hizo.';

-- Nadie lo lee desde el navegador: se resuelve en la capa de dominio, con
-- la llave de servicio.
alter table public.codigos_acceso enable row level security;
revoke all on public.codigos_acceso from anon, authenticated;
