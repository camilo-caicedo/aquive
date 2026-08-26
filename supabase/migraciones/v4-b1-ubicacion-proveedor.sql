-- v4-b1 · La ubicación del prestador en el mapa.
--
-- Decidido por el responsable el 26 de agosto de 2026 y registrado en el
-- ADR 0004. Cambia la regla de producto 10, que hasta hoy fijaba la
-- granularidad máxima en barrio o comuna.
--
-- ---------------------------------------------------------------------
-- Por qué las columnas son como son
-- ---------------------------------------------------------------------
--
-- 1. `acepto_mapa` es una autorización APARTE de `acepto_publicacion`.
--
--    No es celo de más: el artículo 9 de la Ley 1581 exige autorización
--    previa e informada CON FINALIDAD DECLARADA. Quien aceptó que se
--    publicara su nombre y su teléfono no aceptó con eso que se publicara
--    dónde está — es otra finalidad, y reutilizar la casilla vieja sería dar
--    por dado un consentimiento que nadie dio.
--
--    Por eso lleva su propia versión y su propia fecha, igual que la otra:
--    el día que alguien pregunte qué autorizó y cuándo, la respuesta tiene
--    que estar en la fila.
--
-- 2. Sin PostGIS y sin geocoding.
--
--    Dos `numeric` bastan para pintar un punto, y no hay ninguna consulta
--    espacial que hacer: el mapa dibuja lo que la lista ya filtró. PostGIS
--    sería infraestructura para una pregunta que nadie hace.
--
--    Y el punto lo pone el prestador arrastrando el pin, no un servicio que
--    convierte su dirección en coordenadas. Eso ahorra un proveedor externo
--    —el responsable pidió que todo fuera gratis— y de paso deja que cada
--    quien elija su precisión: se puede marcar la esquina en vez del portón.
--
-- 3. El punto vive con la ficha y muere con ella.
--
--    Van en `proveedores` y no en una tabla aparte, así que el borrado a
--    petición del titular se los lleva sin código nuevo.
--
-- Idempotente.

alter table public.proveedores
  add column if not exists latitud  numeric(9, 6),
  add column if not exists longitud numeric(9, 6),
  add column if not exists acepto_mapa boolean not null default false,
  add column if not exists mapa_version text,
  add column if not exists mapa_at timestamptz;

-- Colombia entera cabe holgada aquí. No es una validación de negocio: es que
-- una coordenada fuera de este rectángulo es un error de captura, y un pin
-- en mitad del Atlántico se ve como un fallo de la aplicación.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'proveedores_coordenadas_colombia'
  ) then
    alter table public.proveedores
      add constraint proveedores_coordenadas_colombia
      check (
        (latitud is null and longitud is null)
        or (latitud between -4.5 and 13.5 and longitud between -82.0 and -66.0)
      );
  end if;
end $$;

-- Aparecer en el mapa exige las dos cosas: haber aceptado Y tener punto. Sin
-- esto, una fila con `acepto_mapa` y sin coordenadas —o al revés— se cuela
-- como un caso raro que cada consulta tiene que recordar excluir.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'proveedores_mapa_completo'
  ) then
    alter table public.proveedores
      add constraint proveedores_mapa_completo
      check (
        not acepto_mapa
        or (latitud is not null and longitud is not null and mapa_version is not null)
      );
  end if;
end $$;

comment on column public.proveedores.acepto_mapa is
  'Autorización SEPARADA de acepto_publicacion, artículo 9 de la Ley 1581: publicar dónde está alguien es otra finalidad que publicar su nombre. Quien no la marca sigue saliendo en el directorio, pero no en el mapa.';

comment on column public.proveedores.latitud is
  'Punto puesto por el prestador arrastrando el pin, no geocodificado desde una dirección. Él elige la precisión: puede marcar la esquina en vez del portón.';

-- ---------------------------------------------------------------------
-- La vista pública: el mapa se sirve de aquí, como todo lo demás
-- ---------------------------------------------------------------------
--
-- Las coordenadas salen SOLO si `acepto_mapa`. Ponerlo en la vista y no en
-- cada consulta es lo mismo que ya se hace con la regla de producto 7: si el
-- filtro se duplica, un día una de las copias se olvida, y aquí olvidarse
-- significa publicar dónde encontrar a alguien que no lo autorizó.

drop view if exists public.proveedores_publicos cascade;

create view public.proveedores_publicos as
select
  p.id, p.nombre_visible, p.tipo, p.telefono, p.telefono_verificado,
  p.municipio, p.zona_id, z.nombre as zona_nombre, p.zona_texto,
  p.modalidad, p.dias, p.franjas, p.medios_pago, p.descripcion, p.creado_at,
  case when p.acepto_mapa then p.latitud  end as latitud,
  case when p.acepto_mapa then p.longitud end as longitud,
  coalesce(ofi.oficios, '{}'::text[]) as oficios,
  coalesce(ofi.grupos,  '{}'::text[]) as grupos,
  coalesce(ref.confirmadas, 0::bigint) as referencias_confirmadas,
  coalesce(sp.confirmados,  0::bigint) as servicios_confirmados,
  res.cumplimiento, res.trato, res.puntualidad,
  coalesce(res.total, 0::bigint) as total_resenas,
  coalesce(ofi.modos, '{}'::text[]) as modos
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
  'La única puerta al directorio. Aplica la regla de producto 7 (oficios de riesgo alto escondidos sin respaldo) y ahora también el consentimiento de mapa: latitud y longitud salen NULL si el prestador no marcó acepto_mapa.';

grant select on public.proveedores_publicos to anon, authenticated;

-- ---------------------------------------------------------------------
-- Lo que el `cascade` de arriba se llevó por delante
-- ---------------------------------------------------------------------
--
-- `drop view ... cascade` no pregunta: se lleva todo lo que dependa de la
-- vista, y `municipios_con_proveedores` colgaba de ella. Se recrea idéntica.
--
-- (`oficios_con_proveedores` cuelga de `proveedor_oficios_publicos`, no de
-- esta, así que sobrevivió — pero se recrea también para que este archivo se
-- pueda correr contra una base donde sí se hubiera caído.)

create or replace view public.municipios_con_proveedores as
select distinct m.codigo_dane, m.nombre, m.departamento
from public.municipios m
join public.proveedores_publicos p on p.municipio = m.codigo_dane;

grant select on public.municipios_con_proveedores to anon, authenticated;

create or replace view public.oficios_con_proveedores as
select distinct o.id, o.nombre, o.grupo, o.orden
from public.catalogo_oficios o
join public.proveedor_oficios_publicos pop on pop.oficio_id = o.id;

grant select on public.oficios_con_proveedores to anon, authenticated;
