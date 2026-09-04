-- =====================================================================
-- v6 · Fase B · 7 — la ficha del prestador admite foto
--
-- Hasta ahora no podía: `imagenes.objeto_tipo` solo aceptaba 'muro' y
-- 'producto'. Un prestador podía ponerle foto a lo que vende y no a lo
-- que hace.
--
-- ⚠ No es solo ampliar un CHECK. La foto de una persona es dato personal
-- publicado, así que el mínimo legal 2 —Ley 1581, artículo 9— pide
-- casilla explícita, finalidad declarada y versión de autorización
-- guardada con su fecha. Y es OTRA finalidad que publicar el nombre y el
-- teléfono, igual que el ADR 0004 estableció para el punto en el mapa:
-- una cara no es lo mismo que un número.
--
-- Así que se copia el patrón de `acepto_mapa` / `mapa_version` tal cual,
-- incluido el CHECK que impide una fila a medias.
--
-- El filtro vive en la VISTA y no en cada consulta, por lo mismo que el
-- ADR 0004 lo puso ahí para las coordenadas: un filtro duplicado es una
-- copia que un día alguien se olvida de poner.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · El tipo de objeto
-- ---------------------------------------------------------------------

alter table public.imagenes drop constraint if exists imagenes_objeto_tipo_check;
alter table public.imagenes add constraint imagenes_objeto_tipo_check
  check (objeto_tipo = any (array['muro', 'producto', 'proveedor']));

-- ---------------------------------------------------------------------
-- 2 · La autorización, con su versión y su fecha
-- ---------------------------------------------------------------------

alter table public.proveedores
  add column if not exists acepto_foto boolean not null default false,
  add column if not exists foto_version text,
  add column if not exists foto_at timestamptz;

alter table public.proveedores drop constraint if exists proveedores_foto_completa;
alter table public.proveedores add constraint proveedores_foto_completa
  check (not acepto_foto or (foto_version is not null and foto_at is not null));

-- ---------------------------------------------------------------------
-- 3 · La vista pública
--
-- `foto` es la imagen aprobada más antigua de esa ficha, y NULL si no
-- aceptó — la misma forma que ya usan `productos_publicos` y la vista del
-- muro, y el mismo `case` que las coordenadas.
-- ---------------------------------------------------------------------

create or replace view public.proveedores_publicos as
 SELECT p.id,
    p.nombre_visible,
    p.tipo,
    p.telefono,
    p.telefono_verificado,
    p.municipio,
    p.zona_id,
    z.nombre AS zona_nombre,
    p.zona_texto,
    p.modalidad,
    p.dias,
    p.franjas,
    p.medios_pago,
    p.descripcion,
    p.creado_at,
        CASE
            WHEN p.acepto_mapa THEN p.latitud
            ELSE NULL::numeric
        END AS latitud,
        CASE
            WHEN p.acepto_mapa THEN p.longitud
            ELSE NULL::numeric
        END AS longitud,
    COALESCE(ofi.oficios, '{}'::text[]) AS oficios,
    COALESCE(ofi.grupos, '{}'::text[]) AS grupos,
    COALESCE(ref.confirmadas, 0::bigint) AS referencias_confirmadas,
    COALESCE(sp.confirmados, 0::bigint) AS servicios_confirmados,
    res.cumplimiento,
    res.trato,
    res.puntualidad,
    COALESCE(res.total, 0::bigint) AS total_resenas,
    COALESCE(ofi.modos, '{}'::text[]) AS modos,
    -- ⚠ Va la ÚLTIMA a propósito. `create or replace view` solo deja
    -- AÑADIR columnas al final: meterla en medio renombra las de después y
    -- Postgres lo rechaza. Ponerla aquí evita un `drop ... cascade` sobre
    -- una vista de la que cuelgan otras.
        CASE
            WHEN p.acepto_foto THEN ( SELECT i.ruta
               FROM imagenes i
              WHERE i.objeto_tipo = 'proveedor'::text
                AND i.objeto_id = p.id
                AND i.estado = 'aprobada'::text
              ORDER BY i.subida_at
             LIMIT 1)
            ELSE NULL::text
        END AS foto
   FROM proveedores p
     LEFT JOIN zonas z ON z.id = p.zona_id
     JOIN LATERAL ( SELECT array_agg(DISTINCT pop.oficio_id) AS oficios,
            array_agg(DISTINCT pop.grupo) AS grupos,
            array_agg(DISTINCT pop.modo) AS modos
           FROM proveedor_oficios_publicos pop
          WHERE pop.proveedor_id = p.id) ofi ON ofi.oficios IS NOT NULL
     LEFT JOIN LATERAL ( SELECT count(*) AS confirmadas
           FROM referencias r
          WHERE r.proveedor_id = p.id AND r.estado = 'confirmada'::text) ref ON true
     LEFT JOIN LATERAL ( SELECT count(*) AS confirmados
           FROM servicios_prestados s
          WHERE s.proveedor_id = p.id AND s.confirmado_at IS NOT NULL) sp ON true
     LEFT JOIN LATERAL ( SELECT count(*) AS total,
            round(avg(r.cumplimiento), 1) AS cumplimiento,
            round(avg(r.trato), 1) AS trato,
            round(avg(r.puntualidad), 1) AS puntualidad
           FROM resenas r
          WHERE r.proveedor_id = p.id AND NOT r.oculta) res ON true
  WHERE NOT p.suspendido AND p.acepto_publicacion AND p.telefono_verificado;

grant select on public.proveedores_publicos to anon, authenticated;

-- ---------------------------------------------------------------------
-- 4 · Guardar la autorización de la foto
--
-- Aparte de `guardar_proveedor`, que tiene quince parámetros y no admite
-- uno más sin volverse ilegible. Igual que el punto del mapa, que también
-- se guarda por su cuenta.
-- ---------------------------------------------------------------------

create or replace function public.guardar_foto_proveedor(
  p_acepto boolean,
  p_version text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid := public.proveedor_del_llamante(null);
begin
  if v_id is null then
    raise exception 'No tienes ficha.';
  end if;

  if p_acepto and coalesce(btrim(p_version), '') = '' then
    raise exception 'Falta la versión de la autorización.';
  end if;

  update public.proveedores
     set acepto_foto = p_acepto,
         -- Al quitar el permiso se borran versión y fecha: la
         -- autorización que valía era para publicarla, y ya no vale.
         foto_version = case when p_acepto then btrim(p_version) end,
         foto_at      = case when p_acepto then now() end,
         actualizado_at = now()
   where id = v_id;

  -- Quitar el permiso NO borra la imagen: la vista ya devuelve NULL, y
  -- borrar el objeto del almacén es código (regla 3), no SQL. Se hace
  -- desde el procedimiento que borra la ficha o la imagen.
end;
$function$;

revoke execute on function public.guardar_foto_proveedor(boolean, text) from public, anon;
grant  execute on function public.guardar_foto_proveedor(boolean, text) to authenticated;

-- Comprobar:
--   select id, nombre_visible, foto from public.proveedores_publicos limit 5;
--   -- foto en NULL para quien no aceptó, aunque tenga imagen aprobada.
