-- =====================================================================
-- v6 · Fase C · 2 — `solicitudes.estado` solo admite lo que se alcanza
--
-- El CHECK aceptaba cuatro valores: 'abierta', 'en_coordinacion',
-- 'entregada_parcial' y 'cumplida'. Los dos del medio eran del flujo
-- acompañado y **nadie los escribe desde el ADR 0007**. El propio
-- `src/lib/types.ts` lo admitía: «entran con la Fase F. Todavía no los
-- escribe nadie» — una fase que ese ADR canceló.
--
-- Un estado que no se puede alcanzar no es un estado: es una rama muerta
-- en cada `switch` que lo mire, y una promesa de que existe algo que no
-- existe.
--
-- Y había un fallo real detrás: `gestionar()` en el dominio escribía
-- `estado = 'cerrada'`, que NO está en el CHECK. Cerrar una solicitud de
-- insumos reventaba con una violación de restricción. Es el mismo fallo
-- que ya se arregló en el gemelo de servicios; la copia de insumos se
-- quedó rota. Hoy no se nota porque ninguna pantalla llama a `gestionar`,
-- y eso se arregla en la misma tanda.
--
-- Quedan dos: 'abierta' y 'cumplida'. Cerrar una solicitud propia escribe
-- 'cumplida', igual que hace el panel de administración.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- Por si quedara alguna con un estado que se va. Hoy la tabla está vacía.
update public.solicitudes
   set estado = 'cumplida'
 where estado in ('en_coordinacion', 'entregada_parcial');

alter table public.solicitudes drop constraint if exists solicitudes_estado_check;
alter table public.solicitudes add constraint solicitudes_estado_check
  check (estado = any (array['abierta', 'cumplida']));

-- `estado_activo` decidía qué sigue vivo. Con dos valores es un `=`, pero
-- se conserva la función: la llaman seis sitios y el nombre dice qué
-- pregunta se está haciendo mejor que la comparación.
create or replace function public.estado_activo(p_estado text)
returns boolean
language sql
immutable
set search_path = ''
as $function$
  select p_estado = 'abierta';
$function$;

-- Comprobar:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conrelid = 'public.solicitudes'::regclass and contype = 'c';
