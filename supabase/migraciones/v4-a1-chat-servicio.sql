-- v4-a1 · El chat de Servicios (pantalla 12 del prototipo).
--
-- Decidido en el ADR 0003, decisión 1, aceptada el 26 de agosto de 2026. Es
-- un cambio a la regla 3 anterior —«en Servicios no hay mensajería
-- interna»— y se sostiene por lo que protege: hoy, para contratar, quien
-- pide tiene que llamar, y al llamar le entrega su número a un desconocido.
-- Con chat no revela nada hasta que quiera.
--
-- TABLAS NUEVAS, y no una extensión de `conversaciones`, a propósito.
--
-- `conversaciones` es del flujo acompañado y es TRILATERAL por definición: un
-- trigger impide que acepte mensajes sin aliado a cargo (regla L). El chat de
-- Servicios es bilateral. Meter los dos en la misma tabla obligaría a ese
-- trigger a aprender que a veces la regla no aplica, y una salvaguarda con
-- excepciones es una salvaguarda que alguien va a desactivar por accidente.
-- Dos tablas cuestan un `create table`; un trigger ambiguo cuesta a alguien.
--
-- Idempotente, como todos los de esta carpeta.

-- ---------------------------------------------------------------------
-- 1. El hilo, colgado de la respuesta
-- ---------------------------------------------------------------------
--
-- Cuelga de `respuestas_servicio` y no de la solicitud: el chat existe
-- porque UN prestador respondió a UN pedido, y esa pareja es la que puede
-- hablar. Colgarlo de la solicitud dejaría a los cinco que respondieron en
-- el mismo cuarto.
--
-- El `on delete cascade` es la regla de producto 3 escrita en el esquema:
-- `respuestas_servicio` cae con `solicitudes_servicio`, así que el chat
-- muere con el pedido que lo abrió, sin que ningún job tenga que acordarse.

create table if not exists public.chats_servicio (
  id           uuid primary key default gen_random_uuid(),
  respuesta_id uuid not null unique
                 references public.respuestas_servicio(id) on delete cascade,
  creado_at    timestamptz not null default now(),
  cerrado_at   timestamptz
);

comment on table public.chats_servicio is
  'Hilo bilateral entre quien pide un servicio y el prestador que respondió. Muere con la respuesta, que muere con la solicitud. NO es `conversaciones`: aquel es el hilo trilateral del flujo acompañado y su trigger de regla L no aplica aquí.';

comment on column public.chats_servicio.respuesta_id is
  'UNIQUE: una respuesta abre un hilo y solo uno. Dos hilos para la misma pareja serían dos historias de la misma conversación.';

-- ---------------------------------------------------------------------
-- 2. Los mensajes
-- ---------------------------------------------------------------------
--
-- `autor` es un rol y no un identificador de persona, y eso no es pereza:
-- quien pide NO TIENE CUENTA —entra con el token de su solicitud—, así que
-- no hay id que guardar. Guardar uno obligaría a inventarle identidad a
-- quien la plataforma promete no identificar.
--
-- El tope de 500 caracteres es el de la regla de producto 4. El filtro de
-- datos de contacto NO va aquí: va en la capa de dominio, antes del insert,
-- porque un `check` con expresiones regulares en la base sería imposible de
-- afinar sin una migración cada vez.

create table if not exists public.mensajes_servicio (
  id        uuid primary key default gen_random_uuid(),
  chat_id   uuid not null references public.chats_servicio(id) on delete cascade,
  autor     text not null check (autor in ('quien_pide', 'prestador')),
  cuerpo    text not null check (char_length(cuerpo) between 1 and 500),
  creado_at timestamptz not null default now(),
  oculto    boolean not null default false
);

comment on table public.mensajes_servicio is
  'Mensajes del hilo. Se borran con el chat, que se borra con la solicitud. No hay bandeja histórica: la plataforma no archiva conversaciones.';

comment on column public.mensajes_servicio.autor is
  'Rol, no persona. Quien pide un servicio no tiene cuenta —entra con el token de su solicitud— y no hay identificador suyo que guardar.';

comment on column public.mensajes_servicio.oculto is
  'Moderación reversible. No es borrado lógico de datos personales: el cuerpo lo escribió quien participa en el hilo, y el hilo entero se borra solo.';

create index if not exists idx_mensajes_servicio_chat
  on public.mensajes_servicio (chat_id, creado_at);

-- ---------------------------------------------------------------------
-- 3. Sin RLS, sin grants
-- ---------------------------------------------------------------------
--
-- Las dos tablas quedan revocadas para `anon` y `authenticated`. El acceso va
-- por la capa de dominio (ADR 0001), que es quien comprueba el token de la
-- solicitud o la sesión del prestador antes de leer o escribir. El navegador
-- ya no tiene credenciales de base de datos, así que no hay a quién conceder.

revoke all on public.chats_servicio from anon, authenticated;
revoke all on public.mensajes_servicio from anon, authenticated;

alter table public.chats_servicio enable row level security;
alter table public.mensajes_servicio enable row level security;
