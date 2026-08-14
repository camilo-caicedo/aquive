-- =====================================================================
-- Limpieza de datos de prueba.
--
-- 🔴 Solo contra el proyecto de PRUEBAS.
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
--   · Lo que no cuelga por llave foránea de una raíz marcada lleva su
--     propia columna `es_prueba`. No se deduce después: cuando la raíz ya
--     no existe, nada dice cuál fila era suya.
--
-- Las cinco marcas y lo que arrastra cada una:
--
--   solicitudes       es_prueba              → solicitud_items, respuestas,
--                                              push_suscripciones
--   perfiles          nombre_visible PRUEBA  → ofrecimientos, servidores,
--                                              push_ofertadores, y también
--                                              RESPUESTAS: si un perfil de
--                                              prueba respondió una
--                                              solicitud real, esa respuesta
--                                              se va con él
--   metricas          es_prueba              (sin llave foránea: a mano)
--   sugerencias_item  es_prueba              (el remapeo borra su origen)
--   catalogo_items    es_prueba              (`creado_por` es el admin real)
--
-- Actualizar en CADA fase que agregue una tabla.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Conteo previo — corre esto solo, primero
-- ---------------------------------------------------------------------

select 'metricas' as tabla, count(*) as filas from public.metricas where es_prueba
union all
select 'solicitudes', count(*) from public.solicitudes where es_prueba
union all
select 'perfiles', count(*) from public.perfiles where nombre_visible ilike 'prueba%'
union all
select 'sugerencias_item', count(*) from public.sugerencias_item where es_prueba
union all
select 'catalogo_items', count(*) from public.catalogo_items where es_prueba
order by 1;

-- Lo que arrastra el CASCADE, para que el número no sorprenda:
select 'solicitud_items' as tabla, count(*) as filas
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
union all
select 'ofrecimientos', count(*)
  from public.ofrecimientos o
  join public.perfiles p on p.id = o.perfil_id where p.nombre_visible ilike 'prueba%'
union all
select 'servidores', count(*)
  from public.servidores sv
  join public.perfiles p on p.id = sv.perfil_id where p.nombre_visible ilike 'prueba%'
union all
select 'push_ofertadores', count(*)
  from public.push_ofertadores po
  join public.perfiles p on p.id = po.perfil_id where p.nombre_visible ilike 'prueba%'
union all
-- `respuestas.autor_id` también está en CASCADE desde `perfiles`. Si este
-- número no es cero, un perfil de prueba respondió solicitudes: mira cuáles
-- son reales antes de seguir.
select 'respuestas de perfiles de prueba', count(*)
  from public.respuestas r
  join public.perfiles p on p.id = r.autor_id where p.nombre_visible ilike 'prueba%'
order by 1;

-- Y lo que NO debería salir nunca: filas de prueba enganchadas a algo real.
-- Si alguna de estas dos da distinto de cero, revísalo ANTES de borrar.
select 'items de prueba usados por una solicitud real' as aviso, count(*) as filas
  from public.solicitud_items si
  join public.solicitudes s on s.id = si.solicitud_id
  join public.catalogo_items c on c.id = si.item_id
 where c.es_prueba and not s.es_prueba
union all
select 'items de prueba en el inventario de un perfil real', count(*)
  from public.ofrecimientos o
  join public.perfiles p on p.id = o.perfil_id
  join public.catalogo_items c on c.id = o.item_id
 where c.es_prueba and p.nombre_visible not ilike 'prueba%';

-- ---------------------------------------------------------------------
-- Borrado — corre esto después de revisar el conteo
-- ---------------------------------------------------------------------

begin;

-- `metricas` no tiene ninguna llave foránea: no la alcanza ningún CASCADE
-- y hay que borrarla a mano ANTES de que desaparezca la solicitud que la
-- originó.
delete from public.metricas where es_prueba;

-- CASCADE: solicitud_items, respuestas, push_suscripciones.
delete from public.solicitudes where es_prueba;

-- CASCADE: ofrecimientos, servidores, push_ofertadores.
delete from public.perfiles where nombre_visible ilike 'prueba%';

-- Las sugerencias van después de sus dos referencias: `sugerencia_id` está
-- en `on delete restrict` en `solicitud_items` y en `ofrecimientos`
-- justamente para que borrarlas antes falle en vez de dejar filas violando
-- su propio CHECK. Para cuando llegamos aquí, las dos ya se fueron por
-- CASCADE. Si aquí salta una violación, es que una solicitud o un perfil
-- REAL usa esa sugerencia: no lo fuerces, averigua por qué.
delete from public.sugerencias_item where es_prueba;

-- Y los ítems de catálogo creados durante las pruebas al final, por la
-- misma razón: si salta una violación es que algo real los usa.
delete from public.catalogo_items where es_prueba;

-- Verificación. Va dentro de un bloque que REVIENTA si algo quedó, en vez
-- de un `select` que el operador tendría que mirar: el archivo se corre de
-- una sola vez en el editor SQL, así que un `select` seguido de `commit`
-- no le da a nadie el momento de decidir. Si esto lanza excepción, la
-- transacción entera se revierte y no se borra nada.
do $$
declare v_restantes integer;
begin
  select (select count(*) from public.metricas         where es_prueba)
       + (select count(*) from public.solicitudes      where es_prueba)
       + (select count(*) from public.perfiles         where nombre_visible ilike 'prueba%')
       + (select count(*) from public.sugerencias_item where es_prueba)
       + (select count(*) from public.catalogo_items   where es_prueba)
    into v_restantes;

  if v_restantes <> 0 then
    raise exception 'Quedaron % filas marcadas como prueba. No se borró nada.', v_restantes;
  end if;

  raise notice 'Limpieza correcta: no queda nada marcado como prueba.';
end
$$;

commit;

-- Y confirmar que lo real sigue intacto — estos números deben ser los
-- mismos antes y después de correr el archivo:
--   select count(*) from public.solicitudes;
--   select count(*) from public.perfiles;
--   select count(*) from public.catalogo_items where origen = 'semilla';
