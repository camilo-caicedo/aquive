-- =====================================================================
-- v6 · Fase F · 5 — las vistas que se llevó el cascade
--
-- `v6-f3` (línea 434) hizo `drop view if exists public.proveedores_publicos
-- cascade` para poder meterle a la vista el filtro de dirección del ADR
-- 0017. El `cascade` derriba TODO lo que cuelga de la vista, no solo lo
-- que el autor tenía en mente: recreó `municipios_con_proveedores` y
-- `oficios_con_proveedores` (línea 483 y siguientes) pero se dejó dos, y
-- de paso la vista principal perdió `foto`, que nunca estuvo en el
-- `select` que `v6-f3` volvió a escribir.
--
-- Comprobado contra la base de pruebas antes de escribir esto, con
-- `information_schema.view_table_usage` y `pg_depend`: hoy, con la vista
-- ya rota, lo único que aparece colgando de `proveedores_publicos` es
-- `municipios_con_proveedores`. `oficios_con_proveedores` NO depende de
-- `proveedores_publicos` --depende de `proveedor_oficios_publicos` y de
-- `catalogo_oficios`-- así que un `cascade` sobre `proveedores_publicos`
-- no la toca y no hace falta recrearla aquí. Y `muro_publico` y
-- `productos_publicos` no aparecen en esa lista por la razón mala: ya no
-- existen, se las llevó el `cascade` de `v6-f3` y nadie las devolvió.
--
-- Esta migración repara las tres cosas:
--   1. `proveedores_publicos` recuperada TAL CUAL queda en `v6-f3`
--      (mismo filtro de dirección del ADR 0017, mismo `where`), más la
--      columna `foto` que traía `v6-b7` y que `v6-f3` no copió.
--   2. `municipios_con_proveedores`, que el `cascade` de este archivo se
--      vuelve a llevar por delante --se recrea a continuación, idéntica
--      a como está en `v6-f3`--.
--   3. `muro_publico`, recuperada de `v6-f1` (la forma buena, SIN `cara`:
--      el ADR 0014 dejó al muro una sola cara y no hay que devolverle la
--      que se quitó a propósito).
--   4. `productos_publicos`, recuperada de `v4-f1`, que es la versión más
--      reciente que la toca --comprobado con grep, nada posterior a
--      `v4-f1` vuelve a definirla--.
--
-- Si esta migración necesitara volver a hacer `drop ... cascade` sobre
-- `proveedores_publicos`, las vistas a recrear son las cuatro de arriba:
-- `municipios_con_proveedores`, `oficios_con_proveedores` (por si acaso
-- una versión futura la hace depender de ella), `muro_publico` y
-- `productos_publicos`. Verificarlo de nuevo con la consulta de
-- `pg_depend`/`information_schema.view_table_usage` antes de soltar el
-- `drop`, no fiarse de esta lista sin más.
--
-- La regla de `foto`, mínimo legal 2 (Ley 1581, artículo 9): es OTRA
-- finalidad que publicar nombre y teléfono, con su propia casilla
-- (`proveedores.acepto_foto`), su propia versión y su propia fecha. La
-- vista devuelve la foto SOLO si la persona la autorizó y la imagen está
-- aprobada por moderación; si no, NULL. Es el mismo `case` que ya usan
-- las coordenadas del mapa (ADR 0004) y la dirección (ADR 0017), copiado
-- tal cual de `v6-b7`, que fue la última migración que definió esta
-- columna antes de que `v6-f3` la perdiera.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · `proveedores_publicos`, igual que en `v6-f3` + `foto` de `v6-b7`
-- ---------------------------------------------------------------------

drop view if exists public.proveedores_publicos cascade;

create view public.proveedores_publicos as
select
  p.id, p.nombre_visible, p.tipo, p.telefono, p.telefono_verificado,
  p.municipio, p.zona_id, z.nombre as zona_nombre, p.zona_texto,
  p.modalidad, p.dias, p.franjas, p.medios_pago, p.descripcion, p.creado_at,
  case when p.acepto_mapa then p.latitud  end as latitud,
  case when p.acepto_mapa then p.longitud end as longitud,
  case when p.acepto_direccion then p.direccion end as direccion,
  coalesce(ofi.oficios, '{}'::text[]) as oficios,
  coalesce(ofi.grupos,  '{}'::text[]) as grupos,
  coalesce(ref.confirmadas, 0::bigint) as referencias_confirmadas,
  coalesce(sp.confirmados,  0::bigint) as servicios_confirmados,
  res.cumplimiento, res.trato, res.puntualidad,
  coalesce(res.total, 0::bigint) as total_resenas,
  coalesce(ofi.modos, '{}'::text[]) as modos,
  -- ⚠ `foto`: NULL salvo que `acepto_foto` esté marcado y haya una imagen
  -- aprobada. Mismo `case` que `v6-b7`; no se toca sin ADR.
  case
    when p.acepto_foto then (
      select i.ruta from public.imagenes i
       where i.objeto_tipo = 'proveedor' and i.objeto_id = p.id and i.estado = 'aprobada'
       order by i.subida_at limit 1
    )
    else null
  end as foto
from public.proveedores p
left join public.zonas z on z.id = p.zona_id
join lateral (
  select array_agg(distinct pop.oficio_id) as oficios,
         array_agg(distinct pop.grupo)     as grupos,
         array_agg(distinct pop.modo)      as modos
  from public.proveedor_oficios_publicos pop
  where pop.proveedor_id = p.id
) ofi on ofi.oficios is not null
left join lateral (
  select count(*) as confirmadas from public.referencias r
  where r.proveedor_id = p.id and r.estado = 'confirmada'
) ref on true
left join lateral (
  select count(*) as confirmados from public.servicios_prestados s
  where s.proveedor_id = p.id and s.confirmado_at is not null
) sp on true
left join lateral (
  select count(*) as total,
         round(avg(r.cumplimiento), 1) as cumplimiento,
         round(avg(r.trato), 1)        as trato,
         round(avg(r.puntualidad), 1)  as puntualidad
  from public.resenas r
  where r.proveedor_id = p.id and not r.oculta
) res on true
where not p.suspendido and p.acepto_publicacion and p.telefono_verificado;

comment on view public.proveedores_publicos is
  'La única puerta al directorio. Aplica la regla de producto 7 (oficios de riesgo alto escondidos sin respaldo) y los consentimientos de mapa, dirección y foto: latitud, longitud, dirección y foto salen NULL sin su casilla propia marcada.';

grant select on public.proveedores_publicos to anon, authenticated;

-- ---------------------------------------------------------------------
-- 2 · Lo que el `cascade` de arriba se llevó por delante otra vez
-- ---------------------------------------------------------------------

create or replace view public.municipios_con_proveedores as
select distinct m.codigo_dane, m.nombre, m.departamento
from public.municipios m
join public.proveedores_publicos p on p.municipio = m.codigo_dane;

grant select on public.municipios_con_proveedores to anon, authenticated;

-- `oficios_con_proveedores` NO depende de `proveedores_publicos` (depende
-- de `proveedor_oficios_publicos` y `catalogo_oficios`), así que el
-- `cascade` de arriba no la tocó y sigue en pie tal cual la dejó `v6-f3`.
-- No hace falta recrearla.

-- ---------------------------------------------------------------------
-- 3 · `muro_publico`, recuperada de `v6-f1` (sin `cara`, ADR 0014)
-- ---------------------------------------------------------------------

create view public.muro_publico as
select
  m.id, m.categoria, m.titulo, m.detalle,
  m.municipio, mu.nombre as municipio_nombre,
  m.zona_id, z.nombre as zona_nombre,
  m.autor_nombre, m.creada_at,
  (
    select i.ruta from public.imagenes i
     where i.objeto_tipo = 'muro' and i.objeto_id = m.id and i.estado = 'aprobada'
     order by i.subida_at limit 1
  ) as imagen,
  pp.id as proveedor_id,
  pp.telefono,
  coalesce(pp.telefono_verificado, false) as telefono_verificado,
  ac.nombre as acopio_nombre,
  ac.direccion_acopio as acopio_direccion
from public.publicaciones_muro m
join public.municipios mu on mu.codigo_dane = m.municipio
left join public.zonas z on z.id = m.zona_id
left join public.proveedores pr on pr.perfil_id = m.perfil_id
left join public.proveedores_publicos pp on pp.id = pr.id
left join public.acopios_publicos ac on ac.id = m.acopio_id
where m.estado = 'abierta' and (m.expira_at is null or m.expira_at > now());

grant select on public.muro_publico to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4 · `productos_publicos`, recuperada de `v4-f1` (la más reciente: nada
--     después de `v4-f1` vuelve a definirla, comprobado con grep)
-- ---------------------------------------------------------------------

create view public.productos_publicos as
select
  p.id, p.proveedor_id, pp.nombre_visible as proveedor_nombre,
  pp.municipio, pp.zona_nombre,
  p.nombre, p.detalle, p.modo, p.precio_desde, p.unidad, p.creado_at,
  (select i.ruta from public.imagenes i
    where i.objeto_tipo = 'producto' and i.objeto_id = p.id and i.estado = 'aprobada'
    order by i.subida_at limit 1) as imagen,
  pp.telefono, pp.telefono_verificado, pp.grupos
from public.productos p
join public.proveedores_publicos pp on pp.id = p.proveedor_id
where p.disponible;

grant select on public.productos_publicos to anon, authenticated;

comment on view public.productos_publicos is
  'Hecho en el barrio. Cuelga de `proveedores_publicos`, así que hereda de ella la suspensión y el consentimiento: quien no aparece en el directorio no aparece aquí. El teléfono es el mismo de su ficha, no uno nuevo.';

-- Comprobar:
--   select count(*) from public.proveedores_publicos;               -- no revienta, trae `foto`
--   select * from public.muro_publico limit 1;
--   select * from public.productos_publicos limit 1;
--   select view_name from information_schema.view_table_usage
--    where table_name = 'proveedores_publicos' and table_schema = 'public';
--   -- debe traer: municipios_con_proveedores, muro_publico, productos_publicos
