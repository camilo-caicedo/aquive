-- =====================================================================
-- v2 · Fase A · 7 — el directorio de quien ofrece muestra qué tiene
--
-- Dos cambios sobre `ofertadores_publicos`, y el mismo criterio de
-- pertenencia sobre `municipios_con_ofertadores`:
--
-- 1 · Quién sale. Antes: `tipo = 'ofertador'`. Ahora también los
--     servidores que declararon insumos — desde que el inventario dejó de
--     ser exclusivo de los ofertadores, alguien con matrícula que además
--     tiene cobijas tiene que poder verse en las dos listas. Un ofertador
--     SIN inventario sigue saliendo: el inventario es opcional y no puede
--     convertirse en un requisito por la puerta de atrás.
--
-- 2 · Qué se ve. La tarjeta trae los ítems disponibles, para que quien
--     busca algo concreto no tenga que adivinarlo desde la descripción.
--
-- ⚠ Van los NOMBRES, no las cantidades. Dos razones, y la segunda es la
-- que manda:
--
--   · Una lista pública de quién tiene cuántos litros de agua y en qué
--     municipio es un mapa de existencias para quien tenga malas
--     intenciones. El nombre solo ya responde "¿quién tiene agua?".
--   · El texto de autorización que la persona acepta enumera los datos que
--     se publican. Publicar algo que no está en esa lista es tratar un
--     dato sin autorización, así que el texto se amplía en el mismo commit
--     para incluir los insumos — y hasta ahí, no más.
--
-- La vista lee `ofrecimientos`, que tiene el GRANT revocado. Puede hacerlo
-- porque es `security definer`, igual que `solicitudes_publicas` lee
-- `solicitudes`: la vista ES la frontera.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- El tope de 12 acota el peso de la página, que se ve desde un Android de
-- gama baja con mala señal. `total` deja que la interfaz diga cuántos
-- faltan sin traerlos.
create or replace view public.ofertadores_publicos as
select
  p.id,
  p.nombre_visible,
  p.municipios,
  p.descripcion,
  p.creado_at,
  (select coalesce(jsonb_agg(x order by x->>'nombre'), '[]'::jsonb)
     from (
       select jsonb_build_object(
                'nombre',        coalesce(c.nombre, sg.nombre_propuesto),
                'por_confirmar', o.sugerencia_id is not null
              ) as x
         from public.ofrecimientos o
         left join public.catalogo_items c    on c.id = o.item_id
         left join public.sugerencias_item sg on sg.id = o.sugerencia_id
        where o.perfil_id = p.id and o.disponible
        order by coalesce(c.orden, 9999)
        limit 12
     ) t) as items,
  (select count(*) from public.ofrecimientos o
    where o.perfil_id = p.id and o.disponible) as total_items
from public.perfiles p
where p.suspendido = false
  and p.acepto_publicacion = true
  and (
    p.tipo = 'ofertador'
    or exists (select 1 from public.ofrecimientos o where o.perfil_id = p.id)
  );

grant select on public.ofertadores_publicos to anon, authenticated;

create or replace view public.municipios_con_ofertadores as
select distinct m.codigo_dane, m.nombre, m.departamento
from public.municipios m
join public.perfiles p on m.codigo_dane = any(p.municipios)
where p.suspendido = false
  and p.acepto_publicacion = true
  and (
    p.tipo = 'ofertador'
    or exists (select 1 from public.ofrecimientos o where o.perfil_id = p.id)
  );

grant select on public.municipios_con_ofertadores to anon, authenticated;

-- Comprobar:
--   select nombre_visible, total_items, items from public.ofertadores_publicos;
