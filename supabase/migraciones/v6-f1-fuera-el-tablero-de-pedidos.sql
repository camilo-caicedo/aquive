-- =====================================================================
-- v6 · Fase F · 1 — Fuera el tablero de pedidos (ADR 0014)
--
-- El cliente probó la aplicación en el teléfono y volvió con un rechazo
-- literal a que un prestador tenga que vigilar una cola de pedidos ajenos
-- para encontrar trabajo. Se retira todo lo que dependía de que alguien
-- publicara un pedido y esperara a que otra persona lo encontrara:
--
--   1. El módulo de insumos entero (tablas, vistas, funciones).
--   2. El tablero público de solicitudes de servicio (dos funciones, una
--      tabla, una vista) — no la solicitud de servicio en sí, que sigue
--      viva para quien la escribió y para `/mis-solicitudes`.
--   3. La cara «necesita» del muro. La cara «ofrece» sobrevive: son
--      donaciones, objetos y no pedidos.
--
-- `chats` baja de cinco orígenes a tres: se van `respuesta_insumo_id` y
-- `respuesta_servicio_id`. El chat de la ficha (`proveedor_id`) pasa a ser
-- el único canal de todo lo de servicios.
--
-- ⚠ `catalogo_items` NO se toca. El ADR la nombra para borrar, pero la usan
-- hoy `/registro` (qué puede ofrecer un ofertador), `/admin/catalogo` y el
-- panel de un centro de acopio (`/aliado`) para registrar entregas — verificado
-- por grep antes de escribir esto, no asumido. Borrarla se llevaría por
-- delante tres pantallas vivas que no están en el encargo de esta tanda.
--
-- ⚠ `push_ofertadores` TAMPOCO se toca, por la misma razón y a pesar de que
-- el ADR la nombra. El nombre engaña: es la suscripción de Web Push
-- COMPARTIDA de toda la cuenta, cuelga de `perfil_id` y hoy la usa
-- `avisar()` en `src/server/chat/hilo.ts` para un mensaje de chat nuevo, no
-- solo el flujo de insumos que se retira. Ya lo decía
-- `v6-c5-fuera-la-suscripcion-por-token.sql`: «El nombre push_ofertadores
-- se queda por ahora aunque ya no sea solo de ofertadores». Borrarla habría
-- apagado los avisos de chat en silencio (el envío es best-effort y no
-- lanza), sin que ningún error lo dijera.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- 1 · Las dos funciones que sostenían el tablero de solicitudes de
--     servicio, antes de tocar las tablas de las que leen.
drop function if exists public.solicitudes_de_servicio(text, text, text);
drop function if exists public.responder_servicio(uuid, text, text);

-- 2 · `mis_avisos` y `expirar_servicios` leían `respuestas_servicio` —para
--     avisar de una respuesta y para la métrica de tiempo de respuesta—.
--     Sin `responder_servicio` no vuelve a haber una fila nueva ahí, así
--     que se reescriben sin esa lectura en vez de dejarlas apuntando a una
--     tabla que se borra dos pasos más abajo.
create or replace function public.mis_avisos()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  -- El único aviso que emitía esta función era «alguien respondió a tu
  -- solicitud de servicio», y esa respuesta ya no puede volver a pasar.
  select '[]'::jsonb;
$function$;

create or replace function public.expirar_servicios()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- 1. Métrica anónima ANTES del borrado, que es cuando todavía hay de
  --    dónde sacarla. Mismo orden que expirar_solicitudes().
  --
  --    `hubo_respuesta` y `horas_hasta_respuesta` quedan fijas: sin el
  --    tablero no hay manera de que una solicitud reciba una respuesta
  --    pública, así que estos dos campos de la métrica dejan de tener
  --    de dónde salir.
  insert into public.metricas_servicio (
    municipio, oficio, grupo, hubo_respuesta, hubo_confirmacion,
    horas_hasta_respuesta, es_prueba
  )
  select s.municipio,
         s.grupo,
         s.grupo,
         false,
         s.estado = 'resuelta',
         null,
         s.es_prueba
  from public.solicitudes_servicio s
  where s.expira_at <= now();

  delete from public.solicitudes_servicio where expira_at <= now();

  -- 2. Un código que nadie usó en 30 días es basura. Los confirmados no
  --    se tocan: sostienen una reseña.
  delete from public.servicios_prestados
   where confirmado_at is null and expira_at <= now();
end;
$function$;

-- 3 · Las vistas que alimentaban el tablero y el módulo de insumos entero.
--     Algunas ya no existen en todos los entornos; de ahí el `if exists`.
drop view if exists public.solicitudes_servicio_publicas;
drop view if exists public.solicitudes_publicas;
drop view if exists public.v_cruces;
drop view if exists public.municipios_con_solicitudes;
drop view if exists public.ofertadores_publicos;

-- 4 · `chats` pierde dos de sus cinco puertas (ADR 0009, regla de producto
--     2). El `CHECK chats_un_origen` se reescribe con las tres columnas
--     que quedan: `producto_id`, `publicacion_id`, `proveedor_id`.
alter table public.chats drop constraint if exists chats_un_origen;
alter table public.chats drop constraint if exists chats_respuesta_servicio_id_fkey;
alter table public.chats drop constraint if exists chats_respuesta_servicio_id_key;
alter table public.chats drop constraint if exists chats_respuesta_insumo_id_fkey;
alter table public.chats drop constraint if exists chats_respuesta_insumo_id_key;
alter table public.chats drop column if exists respuesta_servicio_id;
alter table public.chats drop column if exists respuesta_insumo_id;
alter table public.chats add constraint chats_un_origen
  check (num_nonnulls(producto_id, publicacion_id, proveedor_id) = 1);

-- 5 · Las tablas del tablero de servicios y del módulo de insumos.
--     `push_ofertadores` NO va aquí: ver el aviso arriba.
drop table if exists public.respuestas_servicio cascade;
drop table if exists public.solicitudes cascade;
drop table if exists public.solicitud_items cascade;
drop table if exists public.respuestas cascade;

-- 6 · La cara «necesita» del muro se va. Sin ella, `cara` admite un solo
--     valor.
delete from public.publicaciones_muro where cara = 'necesita';
alter table public.publicaciones_muro drop constraint if exists publicaciones_muro_cara_check;
alter table public.publicaciones_muro add constraint publicaciones_muro_cara_check
  check (cara = 'ofrece');

-- 7 · `muro_publico` sin `cara`: ya no hay dos caras que distinguir. Un
--     `create or replace view` no sabe quitar una columna de en medio —hay
--     que recrearla entera, y con ella se pierden los `grant` que traía.
drop view if exists public.muro_publico;
create view public.muro_publico as
select
  m.id, m.categoria, m.titulo, m.detalle,
  m.municipio, mu.nombre as municipio_nombre,
  m.zona_id, z.nombre as zona_nombre,
  m.autor_nombre, m.creada_at,
  (
    select i.ruta from public.imagenes i
     where i.objeto_tipo = 'muro' and i.objeto_id = m.id and i.estado = 'aprobada'
     order by i.subida_at limit 1
  ) as imagen,
  pp.id as proveedor_id,
  pp.telefono,
  coalesce(pp.telefono_verificado, false) as telefono_verificado,
  ac.nombre as acopio_nombre,
  ac.direccion_acopio as acopio_direccion
from public.publicaciones_muro m
join public.municipios mu on mu.codigo_dane = m.municipio
left join public.zonas z on z.id = m.zona_id
left join public.proveedores pr on pr.perfil_id = m.perfil_id
left join public.proveedores_publicos pp on pp.id = pr.id
left join public.acopios_publicos ac on ac.id = m.acopio_id
where m.estado = 'abierta' and (m.expira_at is null or m.expira_at > now());

grant select on public.muro_publico to anon, authenticated;

-- 8 · pg_cron: en este entorno el único trabajo activo es
--     `expirar-servicios` (para `solicitudes_servicio`, ADR 0013, no se
--     toca). No había ningún trabajo venciendo solicitudes de insumos que
--     retirar.

-- Comprobar:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.chats'::regclass;
--   select count(*) from public.publicaciones_muro where cara <> 'ofrece';
--   select viewname from pg_views where schemaname = 'public'
--    and viewname in ('solicitudes_publicas', 'v_cruces',
--      'municipios_con_solicitudes', 'ofertadores_publicos',
--      'solicitudes_servicio_publicas');
