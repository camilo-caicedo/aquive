-- =====================================================================
-- v3 · Fase U · 3 — una oferta en flujo acompañado también cuenta
--
-- ⚠ El error que arregla esto, y por qué importa más de lo que parece.
--
-- En el flujo directo, ofrecer ayuda escribe una fila en `respuestas`. En
-- el acompañado no: escribe una conversación (`iniciar_conversacion`),
-- porque ahí el trato pasa por la fundación y no hay intercambio de
-- contactos. Son dos mecanismos distintos a propósito.
--
-- Pero `solicitudes_publicas.num_respuestas` solo contaba `respuestas`, y
-- el tablero pinta ese número. Resultado: una solicitud acompañada podía
-- tener cinco personas ofreciendo ayuda y seguir diciendo «Sin respuestas»
-- para siempre.
--
-- No es un número mal puesto. Es la señal que usa quien mira el tablero
-- para decidir a cuál solicitud dedicarle su tiempo: «sin respuestas»
-- significa «aquí no ha llegado nadie todavía». Cuando miente, manda gente
-- a ofrecer lo mismo que ya está coordinado y deja sin ayuda a las que de
-- verdad no tienen a nadie. Y a quien ofreció le dice que su oferta no
-- llegó.
--
-- La suma puede contar dos veces a la misma persona si respondió cuando la
-- solicitud era directa y después abrió un hilo al volverse acompañada.
-- Se acepta: el número dice «cuánta gente se ha movido por esto», y
-- equivocarse por exceso en un caso raro es mucho más barato que decir
-- cero cuando hay cinco.
--
-- Solo cambia esa columna de la vista. Ninguna función cambia de firma.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ⚠ Esta es la definición VIVA de la vista, no la de v2-b1: por el camino
-- le llegaron el departamento en el nombre del municipio (v2-k3), las
-- columnas `flujo` y `nota_admin`, y el filtro por `estado_activo` en vez
-- de `= 'abierta'`. Un `create or replace` con la versión vieja habría
-- borrado tres migraciones —Postgres lo impidió al no dejar quitar
-- columnas, pero el filtro y el nombre del municipio sí se habrían ido—.
-- Lo único que cambia aquí es la expresión de `num_respuestas`.

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
  -- Las dos formas de ofrecer ayuda, sumadas: una respuesta en el flujo
  -- directo y una conversación en el acompañado valen lo mismo para quien
  -- mira el tablero — alguien ya se movió por esto.
  (
    (select count(*) from public.respuestas r where r.solicitud_id = s.id)
    + (select count(*) from public.conversaciones c where c.solicitud_id = s.id)
  ) as num_respuestas,
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
  (select coalesce(array_agg(si.item_id) filter (where si.item_id is not null), '{}')
     from public.solicitud_items si where si.solicitud_id = s.id) as item_ids,
  (select coalesce(array_agg(si.sugerencia_id) filter (where si.sugerencia_id is not null), '{}')
     from public.solicitud_items si where si.solicitud_id = s.id) as sugerencia_ids,
  s.flujo,
  s.nota_admin
from public.solicitudes s
join public.municipios m on m.codigo_dane = s.municipio
where public.estado_activo(s.estado)
  and s.expira_at > now();

grant select on public.solicitudes_publicas to anon, authenticated;

-- Comprobar, sobre una solicitud acompañada con un hilo y sin respuestas:
--   select codigo, num_respuestas from public.solicitudes_publicas;
