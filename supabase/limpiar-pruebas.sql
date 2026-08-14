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
--   · Lo que no cuelga por FK de una raíz marcada se identifica ANTES de
--     borrar las raíces, no después. Es el mismo problema de `metricas`:
--     cuando la solicitud ya no existe, nada dice cuál fila era suya.
--
-- Las tres raíces marcadas y lo que arrastran:
--
--   solicitudes  es_prueba = true      → solicitud_items, respuestas,
--                                        push_suscripciones
--   perfiles     nombre_visible PRUEBA → ofrecimientos, servidores,
--                                        push_ofertadores
--   metricas     es_prueba = true      (sin FK: a mano)
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
order by 1;

-- Y lo que NO cuelga de ninguna raíz y hay que identificar antes:
select 'sugerencias_item' as tabla, count(*) as filas from public.sugerencias_item sg
 where sg.nombre_propuesto ilike 'prueba%'
    or exists (select 1 from public.solicitud_items si
                 join public.solicitudes s on s.id = si.solicitud_id
                where si.sugerencia_id = sg.id and s.es_prueba)
    or exists (select 1 from public.ofrecimientos o
                 join public.perfiles p on p.id = o.perfil_id
                where o.sugerencia_id = sg.id and p.nombre_visible ilike 'prueba%')
union all
select 'catalogo_items', count(*) from public.catalogo_items c
 where c.origen <> 'semilla'
   and exists (select 1 from public.sugerencias_item sg
                where sg.item_resultante_id = c.id
                  and sg.nombre_propuesto ilike 'prueba%')
order by 1;

-- ---------------------------------------------------------------------
-- Borrado — corre esto después de revisar el conteo
-- ---------------------------------------------------------------------

begin;

-- Se identifican PRIMERO, mientras todavía existe la solicitud o el perfil
-- que las señala. Después del `delete` ya no habría por dónde.
create temp table _sug_prueba on commit drop as
  select sg.id from public.sugerencias_item sg
   where sg.nombre_propuesto ilike 'prueba%'
      or exists (select 1 from public.solicitud_items si
                   join public.solicitudes s on s.id = si.solicitud_id
                  where si.sugerencia_id = sg.id and s.es_prueba)
      or exists (select 1 from public.ofrecimientos o
                   join public.perfiles p on p.id = o.perfil_id
                  where o.sugerencia_id = sg.id and p.nombre_visible ilike 'prueba%');

create temp table _items_prueba on commit drop as
  select c.id from public.catalogo_items c
   where c.origen <> 'semilla'
     and exists (select 1 from public.sugerencias_item sg
                  where sg.item_resultante_id = c.id
                    and sg.id in (select id from _sug_prueba));

-- `metricas` no tiene ninguna FK: no la alcanza ningún CASCADE y hay que
-- borrarla a mano ANTES de que desaparezca la solicitud que la originó.
delete from public.metricas where es_prueba;

-- CASCADE: solicitud_items, respuestas, push_suscripciones.
delete from public.solicitudes where es_prueba;

-- CASCADE: ofrecimientos, servidores, push_ofertadores.
delete from public.perfiles where nombre_visible ilike 'prueba%';

-- Las sugerencias van después de sus dos referencias: `sugerencia_id` está
-- en `on delete restrict` en las dos tablas justamente para que borrarlas
-- antes falle en vez de dejar filas violando su propio CHECK.
delete from public.sugerencias_item where id in (select id from _sug_prueba);

-- Y los ítems de catálogo aprobados durante las pruebas al final. Si aquí
-- salta una violación de llave foránea, es que una solicitud REAL usa ese
-- ítem: no lo fuerces, quítalo de la lista.
delete from public.catalogo_items where id in (select id from _items_prueba);

-- Verificación: todo tiene que dar 0. Si no, NO hagas commit.
select
  (select count(*) from public.metricas    where es_prueba)                      as metricas,
  (select count(*) from public.solicitudes where es_prueba)                      as solicitudes,
  (select count(*) from public.perfiles    where nombre_visible ilike 'prueba%')  as perfiles,
  (select count(*) from public.sugerencias_item
    where nombre_propuesto ilike 'prueba%')                                      as sugerencias,
  (select count(*) from public.ofrecimientos)                                    as ofrecimientos;

commit;

-- Y confirmar que lo real sigue intacto — estos números deben ser los
-- mismos antes y después de correr el archivo:
--   select count(*) from public.solicitudes;
--   select count(*) from public.perfiles;
--   select count(*) from public.catalogo_items where origen = 'semilla';
