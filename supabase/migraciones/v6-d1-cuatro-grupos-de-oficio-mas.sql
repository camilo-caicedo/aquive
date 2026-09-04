-- =====================================================================
-- v6 · Fase D · 1 — cuatro grupos de oficio más (ADR 0012)
--
-- `construccion`, `ensenanza`, `eventos` y `digital`. Doce en total.
--
-- Son dos `CHECK`, no uno, y los dos hacen falta: `catalogo_oficios.grupo`
-- es lo que un prestador marca en su ficha, y `solicitudes_servicio.grupo`
-- es lo que elige quien pide desde el ADR 0011. Si solo se ensancha el
-- primero, el catálogo acepta el oficio nuevo y la solicitud de esa misma
-- categoría se rechaza con una violación de restricción.
--
-- ⚠ La lista de valores se repite en cuatro sitios y no hay forma de que
-- sea uno solo: aquí dos veces, en `GrupoOficio` del contrato y en el
-- union de `src/lib/types.ts`. Los `CHECK` son la garantía —lo que impide
-- que un valor inventado entre—; los otros dos son tipos, y un tipo no
-- defiende una tabla. Si se añade un grupo, se tocan los cuatro.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

alter table public.catalogo_oficios
  drop constraint if exists catalogo_oficios_grupo_check;

alter table public.catalogo_oficios
  add constraint catalogo_oficios_grupo_check
  check (grupo = any (array[
    'comida', 'belleza', 'confeccion', 'transporte',
    'aseo', 'cuidado', 'reparacion', 'otros',
    -- ADR 0012
    'construccion', 'ensenanza', 'eventos', 'digital'
  ]));

alter table public.solicitudes_servicio
  drop constraint if exists solicitudes_servicio_grupo_check;

alter table public.solicitudes_servicio
  add constraint solicitudes_servicio_grupo_check
  check (grupo = any (array[
    'comida', 'belleza', 'confeccion', 'transporte',
    'aseo', 'cuidado', 'reparacion', 'otros',
    'construccion', 'ensenanza', 'eventos', 'digital'
  ]));

-- Los oficios entran por `seed-oficios.sql`, que es idempotente y es donde
-- vive la taxonomía entera con su razón escrita. Correrlo después de esto.
