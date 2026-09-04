-- =====================================================================
-- v6 · Fase F · 2 — la solicitud es una orden dirigida a un prestador
-- (ADR 0017)
--
-- El ADR 0016 (v6-f3) retiró el tablero público de solicitudes de
-- servicio: la tabla `solicitudes_servicio` se quedó viva —es lo que
-- pide quien busca un servicio y lo que enseña `/mis-solicitudes`— pero
-- sin nada que la dirigiera a nadie. Esto la convierte en lo que el
-- cliente pidió: una orden con destinatario, que ese destinatario acepta
-- o rechaza desde su ficha.
--
-- Tres cambios:
--   1. `proveedor_id`, obligatorio y con cascada: nace dirigida y muere
--      con la ficha que la recibió.
--   2. Cinco estados en vez de dos, con las transiciones que gobierna el
--      dominio (`src/server/servicios/transiciones.ts`), no la base.
--   3. La caducidad automática deja de alcanzar a una orden ya aceptada:
--      el prestador quedó en ir, y 15 días es una cifra pensada para
--      «nadie respondió», no para «cuánto tarda el trabajo».
--
-- De paso, dos columnas que solo tenían sentido en el tablero abierto —
-- `urgencia`, para ordenar la cola, y `capacidad_pago`, para mostrar
-- primero a quien trabaja gratis— se van con él: no hay cola que ordenar
-- ni nadie que la mire para elegir a quién responder primero. Dejarlas
-- `NOT NULL` habría obligado a fabricar una respuesta a una pregunta que
-- el formulario corto ya no hace, y este proyecto no rellena campos con
-- datos inventados.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · `proveedor_id`
--
-- Las solicitudes que ya existen nacieron del tablero abierto: no tienen
-- destinatario, y no hay de dónde deducir uno sensato —`respuestas_
-- servicio`, que habría dicho quién contestó, ya se borró en v6-f3—.
-- Inventar un proveedor sería fabricar una orden que nadie aceptó, así
-- que se van. Mismo criterio que v5-a3 con lo que se quedó sin
-- `perfil_id` al llegar el ADR 0006.
-- ---------------------------------------------------------------------

delete from public.solicitudes_servicio;

alter table public.solicitudes_servicio
  add column if not exists proveedor_id uuid references public.proveedores(id) on delete cascade;

alter table public.solicitudes_servicio
  alter column proveedor_id set not null;

comment on column public.solicitudes_servicio.proveedor_id is
  'A quién se le pide (ADR 0017). Obligatoria desde el nacimiento de la fila, nunca se rellena después. ON DELETE CASCADE: la orden muere con la ficha, regla de producto 3.';

-- ---------------------------------------------------------------------
-- 2 · Cinco estados
--
-- 'abierta' -> 'pendiente': nadie ha contestado, que es lo mismo antes y
-- después. 'resuelta' -> 'no_concretada': se cerró, pero este dato no
-- garantiza que el trabajo se haya hecho —'realizada' exigiría un cierre
-- explícito que la fila vieja no tiene, y afirmarlo sería inventar—. En
-- la práctica el borrado de arriba deja la tabla vacía; el UPDATE se deja
-- escrito por si algún entorno conserva filas que este script no vio.
-- ---------------------------------------------------------------------

update public.solicitudes_servicio set estado = 'pendiente' where estado = 'abierta';
update public.solicitudes_servicio set estado = 'no_concretada' where estado = 'resuelta';

alter table public.solicitudes_servicio
  drop constraint if exists solicitudes_servicio_estado_check;

alter table public.solicitudes_servicio
  alter column estado set default 'pendiente';

alter table public.solicitudes_servicio
  add constraint solicitudes_servicio_estado_check
  check (estado = any (array['pendiente','aceptada','realizada','rechazada','no_concretada']));

comment on column public.solicitudes_servicio.estado is
  'pendiente | aceptada | realizada | rechazada | no_concretada (ADR 0017). Transiciones válidas: pendiente -> aceptada | rechazada; aceptada -> realizada | no_concretada. Las comprueba el dominio, no esta columna.';

-- ---------------------------------------------------------------------
-- 3 · Fuera `urgencia` y `capacidad_pago`
--
-- Servían para ordenar y filtrar el tablero público. Sin tablero, nadie
-- las lee: el formulario corto de la orden dirigida no vuelve a
-- preguntarlas.
-- ---------------------------------------------------------------------

alter table public.solicitudes_servicio drop column if exists urgencia;
alter table public.solicitudes_servicio drop column if exists capacidad_pago;

-- ---------------------------------------------------------------------
-- 4 · El índice de la bandeja del prestador
--
-- Es la consulta que hace cada vez que abre `/perfil/solicitudes-
-- recibidas`: sus órdenes, agrupadas por estado.
-- ---------------------------------------------------------------------

create index if not exists idx_solicitudes_servicio_proveedor
  on public.solicitudes_servicio (proveedor_id, estado);

-- El índice del tablero abierto ya no puede calzar ninguna fila —ningún
-- estado va a volver a valer 'abierta'— y era exactamente lo que servía
-- para listar por municipio y categoría, que es lo que hacía el tablero.
drop index if exists public.idx_solicitudes_servicio_vigentes;

comment on table public.solicitudes_servicio is
  'Una orden dirigida a un prestador (ADR 0017), no un pedido al aire. Regla 1 completa del mínimo legal: describe un servicio que hace falta, no a quien lo pide. Borrado duro a los 15 días SOLO mientras está pendiente (`expirar_servicios`); aceptada no vence sola.';

-- ---------------------------------------------------------------------
-- 5 · `expirar_servicios()` solo vence lo pendiente
--
-- El trabajo programado `expirar-servicios` (pg_cron, cada 15 minutos,
-- ver v3-s1) sigue llamando a esta misma función; lo que cambia es su
-- cuerpo, no el `cron.schedule`.
-- ---------------------------------------------------------------------

create or replace function public.expirar_servicios()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- 1. Métrica anónima ANTES del borrado, que es cuando todavía hay de
  --    dónde sacarla. Solo de lo PENDIENTE: una orden aceptada no se
  --    vence aquí (ADR 0017), así que nunca llega a esta consulta.
  insert into public.metricas_servicio (
    municipio, oficio, grupo, hubo_respuesta, hubo_confirmacion,
    horas_hasta_respuesta, es_prueba
  )
  select s.municipio, s.grupo, s.grupo, false, false, null, s.es_prueba
  from public.solicitudes_servicio s
  where s.estado = 'pendiente' and s.expira_at <= now();

  delete from public.solicitudes_servicio
   where estado = 'pendiente' and expira_at <= now();

  -- 2. Un código que nadie usó en 30 días es basura. Los confirmados no
  --    se tocan: sostienen una reseña.
  delete from public.servicios_prestados
   where confirmado_at is null and expira_at <= now();
end;
$function$;

revoke execute on function public.expirar_servicios() from public, anon, authenticated;

comment on function public.expirar_servicios() is
  'Solo lo llama pg_cron (trabajo "expirar-servicios"). Borrado duro (regla 4), y SOLO de solicitudes_servicio en estado pendiente (ADR 0017): una orden aceptada no vence sola. No toca proveedores: esa tabla no expira.';

-- ---------------------------------------------------------------------
-- 6 · El chat nace con la orden: `chats.solicitud_servicio_id`
--
-- Pedido del cliente, probando la aplicación: que al pedir un servicio se
-- cree ya el hilo con la orden dentro, en vez de mandar a otra pantalla y
-- dejar que el chat de la ficha (`chats.proveedor_id`) sea un canal aparte
-- sin el detalle del pedido a la vista.
--
-- Van cuarta columna y no un par (tipo, id): mismo argumento del ADR 0009
-- para las otras tres — un par «tipo + id» no puede llevar
-- `on delete cascade`, y la regla de producto 3 exige que el hilo muera con
-- lo que lo abrió. `unique`, no un índice parcial con `iniciado_por` como
-- las de producto/publicación/ficha: una orden YA identifica a los dos
-- lados desde que nace (`solicitudes_servicio.perfil_id` es quien pide,
-- `proveedor_id` dice quién ofrece), así que no hace falta que nadie
-- «ocupe» un hueco y solo puede existir un hilo por orden.
-- ---------------------------------------------------------------------

alter table public.chats
  add column if not exists solicitud_servicio_id uuid
    references public.solicitudes_servicio(id) on delete cascade;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chats_solicitud_servicio_id_key'
  ) then
    alter table public.chats
      add constraint chats_solicitud_servicio_id_key unique (solicitud_servicio_id);
  end if;
end $$;

-- `chats_iniciado_por_donde_toca` NO cambia: ya exige `iniciado_por is not
-- null` solo cuando `producto_id`, `publicacion_id` o `proveedor_id` es la
-- columna no nula, y con `solicitud_servicio_id` ninguna de esas tres lo
-- es — así que la orden, sin tocar el `check`, ya exige `iniciado_por is
-- null`, que es justo lo que le corresponde por identificar a los dos lados.

alter table public.chats drop constraint if exists chats_un_origen;
alter table public.chats add constraint chats_un_origen check (
  num_nonnulls(producto_id, publicacion_id, proveedor_id, solicitud_servicio_id) = 1
);

comment on column public.chats.solicitud_servicio_id is
  'De qué orden nace el hilo (ADR 0017). ON DELETE CASCADE: el hilo muere con la orden, regla de producto 3. UNIQUE simple, no por iniciado_por: la orden ya identifica a los dos lados.';

-- Comprobar:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.solicitudes_servicio'::regclass
--    order by conname;
--   select column_name from information_schema.columns
--    where table_schema = 'public' and table_name = 'solicitudes_servicio'
--    order by column_name;
--   select indexname from pg_indexes
--    where schemaname = 'public' and tablename = 'solicitudes_servicio';
