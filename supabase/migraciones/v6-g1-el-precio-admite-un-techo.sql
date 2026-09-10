-- =====================================================================
-- v6 · Fase G · 1 — el precio admite un techo opcional, además del piso
--
-- ADR 0026 (ver docs/decisiones/0026-el-precio-admite-un-techo.md).
-- Hasta hoy `proveedor_oficios.precio_desde` era el único número: «el
-- proveedor declaró un piso, no una tarifa cerrada» (comentario de
-- src/lib/servicios.ts). La Fundación pide poder declarar también un
-- techo, sin volverlo campo de texto libre (regla de producto 1).
--
-- `precio_hasta` es NULLABLE a propósito: todo oficio ya publicado sigue
-- válido sin declarar techo, y `precioLegible()` sigue mostrando solo
-- «Desde $X» cuando no lo hay.
--
-- Dos CHECK, no uno: el primero (rango 0..99999999) es el mismo molde que
-- ya tiene `precio_desde`; el segundo (`hasta >= desde`) es el que le da
-- sentido a la palabra «techo» — sin él, alguien podría guardar un rango
-- invertido y nadie lo notaría hasta que se viera mal en la ficha.
--
-- No se toca `proveedor_oficios_sugeridos`: es la cola de sugerencias al
-- catálogo (ADR 0013), no la declaración de precio de un oficio ya
-- publicado.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

alter table public.proveedor_oficios
  add column if not exists precio_hasta numeric(10, 0);

alter table public.proveedor_oficios
  drop constraint if exists proveedor_oficios_precio_hasta_check;
alter table public.proveedor_oficios
  add constraint proveedor_oficios_precio_hasta_check
  check (precio_hasta is null or (precio_hasta >= 0 and precio_hasta <= 99999999));

alter table public.proveedor_oficios
  drop constraint if exists proveedor_oficios_rango_check;
alter table public.proveedor_oficios
  add constraint proveedor_oficios_rango_check
  check (precio_hasta is null or precio_desde is null or precio_hasta >= precio_desde);

-- Comprobar:
--   select count(*) from public.proveedor_oficios
--    where precio_hasta is not null and precio_hasta < precio_desde;   -- 0
