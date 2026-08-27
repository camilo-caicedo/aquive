-- =====================================================================
-- v6 · Fase C · 6 — `entregas` puede registrarse desde el acopio
--
-- ADR 0008, decisión 2: un centro de acopio «registra lo que entra y lo
-- que sale». La tabla existe desde antes y está vacía —cero filas—, y
-- **ninguna pantalla, procedimiento ni función la escribe o la lee**. El
-- contrato de acopios tiene un solo procedimiento, `lista`. Y
-- `como-funciona.tsx` se lo promete a la persona: «En el acopio, registra
-- qué entregaste».
--
-- La tabla venía del flujo acompañado, donde una entrega siempre respondía
-- a una solicitud con código. Dos cosas hay que soltar para que sirva a un
-- mostrador:
--
-- 1 · `solicitud_codigo` era `not null`. Quien deja una caja de ropa en un
--     centro no viene con el código de nadie: la mayoría de lo que entra y
--     sale no responde a ninguna solicitud. Pasa a anulable.
--
-- 2 · Falta decir si la cosa ENTRA o SALE. Sin eso la tabla registra
--     movimientos sin dirección, y «lo que entra y lo que sale» no se
--     puede contar.
--
-- Lo que NO cambia, y es lo que importa: `entregas` sigue sin un solo dato
-- personal —ítem, cantidad, municipio, fecha— y sin llave foránea hacia la
-- solicitud, para sobrevivir a su borrado (regla de producto 3). El código
-- se guarda como texto, copiado, no como referencia.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

alter table public.entregas alter column solicitud_codigo drop not null;

alter table public.entregas
  add column if not exists direccion text not null default 'entra';

alter table public.entregas drop constraint if exists entregas_direccion_check;
alter table public.entregas add constraint entregas_direccion_check
  check (direccion = any (array['entra', 'sale']));

-- `origen_tipo` gana el caso del mostrador: alguien llegó y lo dejó, sin
-- que venga de una publicación ni de un producto.
alter table public.entregas drop constraint if exists entregas_origen_tipo_check;
alter table public.entregas add constraint entregas_origen_tipo_check
  check (origen_tipo is null
         or origen_tipo = any (array['muro', 'producto', 'directo', 'mostrador']));

-- Comprobar:
--   select direccion, count(*) from public.entregas group by 1;
