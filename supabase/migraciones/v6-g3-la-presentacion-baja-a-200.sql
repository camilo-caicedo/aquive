-- =====================================================================
-- v6 · Fase G · 3 — la presentación del prestador baja de 300 a 200
-- caracteres
--
-- Revisión de la Fundación Nodo Social, 2026-09-10 (aquive-cambios.pdf).
-- Calibración de tope, no cambio de núcleo invariante: no hace falta ADR
-- (docs/decisiones/LEEME.md), solo esta migración y la fila de la tabla en
-- CLAUDE.md § "Los campos libres tienen tope y filtro".
--
-- Dos tablas llevan el mismo CHECK: `proveedores.descripcion` (el carné) y
-- `perfiles.descripcion` (gemela, para cuando `tipo = 'servidor'`
-- publica). Las dos bajan juntas para no dejar una desalineada.
--
-- No se trunca ningún texto existente sin avisar: bajar el CHECK sin
-- `update` previo dejaría inválida cualquier fila entre 201 y 300
-- caracteres. `left(...)` recorta en seco al carácter 200 — antes de
-- correr esto en una base con datos reales, revisar a mano cuántas filas
-- lo necesitan:
--
--   select id, nombre_visible, char_length(descripcion)
--     from public.proveedores
--    where char_length(descripcion) > 200;
--
-- Hoy, en la base de pruebas, son cero.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

update public.proveedores
   set descripcion = left(descripcion, 200)
 where descripcion is not null and char_length(descripcion) > 200;

alter table public.proveedores drop constraint if exists proveedores_descripcion_check;
alter table public.proveedores add constraint proveedores_descripcion_check
  check (char_length(descripcion) <= 200);

update public.perfiles
   set descripcion = left(descripcion, 200)
 where descripcion is not null and char_length(descripcion) > 200;

alter table public.perfiles drop constraint if exists perfiles_descripcion_check;
alter table public.perfiles add constraint perfiles_descripcion_check
  check (char_length(descripcion) <= 200);

-- Comprobar:
--   select count(*) from public.proveedores where char_length(descripcion) > 200;  -- 0
--   select count(*) from public.perfiles    where char_length(descripcion) > 200;  -- 0
