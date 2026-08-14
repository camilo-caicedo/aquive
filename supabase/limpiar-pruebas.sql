-- =====================================================================
-- Limpieza de datos de prueba.
--
-- 🔴 Solo contra el proyecto de PRUEBAS. En producción no hay nada
-- marcado como prueba y correrlo ahí no tendría sentido.
--
-- Cómo se usa, en dos pasos y en este orden:
--
--   1. Corre SOLO el bloque «Conteo previo». No borra nada. Revisa los
--      números: son exactamente las filas que van a desaparecer.
--   2. Si cuadran, corre el bloque «Borrado». Va dentro de una
--      transacción explícita y termina verificando que quedó en cero.
--
-- Reglas que cumple este archivo, y que hay que mantener al agregar
-- tablas en cada fase:
--   · Ningún `delete` sin `where`.
--   · Ningún `where` que dependa de una fecha ni de un rango de ids:
--     siempre la marca.
--   · Las tablas sin llave foránea van primero y a mano, porque el
--     CASCADE no las alcanza.
--
-- Actualizar en CADA fase que agregue una tabla.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Conteo previo — corre esto solo, primero
-- ---------------------------------------------------------------------

select 'metricas'    as tabla, count(*) as filas from public.metricas    where es_prueba
union all
select 'solicitudes',          count(*)          from public.solicitudes where es_prueba
order by 1;

-- Lo que arrastra el borrado de `solicitudes` por CASCADE, para que el
-- número no sorprenda:
select 'solicitud_items'    as tabla, count(*) as filas
  from public.solicitud_items si
  join public.solicitudes s on s.id = si.solicitud_id where s.es_prueba
union all
select 'respuestas', count(*)
  from public.respuestas r
  join public.solicitudes s on s.id = r.solicitud_id where s.es_prueba
union all
select 'push_suscripciones', count(*)
  from public.push_suscripciones ps
  join public.solicitudes s on s.id = ps.solicitud_id where s.es_prueba
order by 1;

-- ---------------------------------------------------------------------
-- Borrado — corre esto después de revisar el conteo
-- ---------------------------------------------------------------------

begin;

-- `metricas` no tiene ninguna FK: no la alcanza ningún CASCADE y hay que
-- borrarla a mano ANTES de que desaparezca la solicitud que la originó.
delete from public.metricas where es_prueba;

-- El CASCADE se lleva solicitud_items, respuestas y push_suscripciones.
delete from public.solicitudes where es_prueba;

-- Verificación: las dos columnas tienen que dar 0. Si no, no hagas commit.
select
  (select count(*) from public.metricas    where es_prueba) as metricas_restantes,
  (select count(*) from public.solicitudes where es_prueba) as solicitudes_restantes;

commit;

-- Y confirmar que lo real sigue intacto — este número debe ser el mismo
-- antes y después de correr el archivo:
--   select count(*) from public.solicitudes;
--   select count(*) from public.perfiles;
