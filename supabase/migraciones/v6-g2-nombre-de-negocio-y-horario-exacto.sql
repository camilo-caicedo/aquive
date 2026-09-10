-- =====================================================================
-- v6 · Fase G · 2 — nombre de negocio y horario por hora exacta, sumados
-- sin reemplazar
--
-- ADR 0027 (ver docs/decisiones/0027-nombre-de-negocio-y-horarios-por-hora.md).
--
-- Dos columnas nuevas en `proveedores`, las dos NULLABLE y las dos sin
-- tocar nada de lo que ya existe:
--
-- `nombre_negocio` — hoy solo hay `nombre_visible`, compartido por persona
-- y microempresa. Se agrega aparte en vez de reusar esa columna para no
-- perder el nombre de la persona detrás del negocio. Sin CHECK que lo
-- acople a `tipo = 'microempresa'`: eso lo valida el contrato (Zod), no la
-- base — es una preferencia de presentación, no una garantía de
-- integridad.
--
-- `hora_desde` / `hora_hasta` — horario preciso, opcional, que se muestra
-- ADEMÁS de `dias` y `franjas` (que NO se tocan: siguen siendo el filtro
-- amplio de /directorio y la consulta pública). `time`, sin huso: toda
-- Colombia continental e insular corre en el mismo huso horario, y
-- `municipios` ya no necesita una columna de huso para esto.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

alter table public.proveedores
  add column if not exists nombre_negocio text,
  add column if not exists hora_desde time,
  add column if not exists hora_hasta time;

alter table public.proveedores
  drop constraint if exists proveedores_horario_rango;
alter table public.proveedores
  add constraint proveedores_horario_rango
  check (hora_hasta is null or hora_desde is null or hora_hasta > hora_desde);

alter table public.proveedores
  drop constraint if exists proveedores_nombre_negocio_check;
alter table public.proveedores
  add constraint proveedores_nombre_negocio_check
  check (nombre_negocio is null or (char_length(nombre_negocio) >= 3 and char_length(nombre_negocio) <= 60));

-- Comprobar:
--   select count(*) from public.proveedores
--    where hora_hasta is not null and hora_desde is not null and hora_hasta <= hora_desde;  -- 0
