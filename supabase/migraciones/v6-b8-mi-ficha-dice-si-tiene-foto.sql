-- =====================================================================
-- v6 · Fase B · 8 — `mi_proveedor()` dice si la ficha tiene foto
--
-- Cola de `v6-b7`. El formulario de la ficha necesita saber dos cosas al
-- abrirse: si esa persona autorizó publicar su foto, y cuál es, para
-- enseñarla y poder quitarla. Se añaden al mismo objeto que ya devuelve
-- `acepto_mapa` y `mapa_version`.
--
-- ⚠ `foto` sale de `imagenes` y NO pasa por `proveedores_publicos`: aquí
-- se la está enseñando a su dueña, no al público, así que se ve aunque
-- todavía esté en cola de moderación y aunque haya retirado el permiso.
-- Justo eso es lo que hace falta para poder quitarla.
--
-- Y se retira `guardar_foto_proveedor`, que se creó en `v6-b7` y no llegó
-- a usarse: guardar la autorización tiene que borrar además el objeto del
-- almacén de la foto anterior (regla 3), y `on delete cascade` no borra un
-- archivo de un bucket. Eso es código, no SQL, y vive en
-- `src/server/servicios/foto.ts` como procedimiento del contrato (ADR
-- 0001).
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

drop function if exists public.guardar_foto_proveedor(boolean, text);

create or replace function public.mi_proveedor(p_token text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_id uuid := public.proveedor_del_llamante(p_token);
  v_out jsonb;
begin
  if v_id is null then
    return null;
  end if;

  select jsonb_build_object(
    'id', p.id,
    'nombre_visible', p.nombre_visible,
    'tipo', p.tipo,
    'telefono', p.telefono,
    'telefono_verificado', p.telefono_verificado,
    'municipio', p.municipio,
    'zona_id', p.zona_id,
    'zona_texto', p.zona_texto,
    'modalidad', p.modalidad,
    'dias', p.dias,
    'franjas', p.franjas,
    'medios_pago', p.medios_pago,
    'descripcion', p.descripcion,
    'suspendido', p.suspendido,
    'alta_asistida', p.alta_asistida,
    'sin_cuenta', p.perfil_id is null,
    'creado_at', p.creado_at,
    -- Lo que se añade en v4-e1. La versión y la fecha son las que ESA persona
    -- aceptó, no las de hoy.
    'autorizacion_version', p.autorizacion_version,
    'autorizacion_at', p.autorizacion_at,
    'acepto_mapa', p.acepto_mapa,
    'mapa_version', p.mapa_version,
    'mapa_at', p.mapa_at,
    -- Lo que se añade en v6-b7/b8: la foto y su autorización aparte.
    'acepto_foto', p.acepto_foto,
    'foto_version', p.foto_version,
    'foto_at', p.foto_at,
    'foto', (
      select i.ruta
        from public.imagenes i
       where i.objeto_tipo = 'proveedor'
         and i.objeto_id = p.id
       order by i.subida_at
       limit 1),
    'foto_estado', (
      select i.estado
        from public.imagenes i
       where i.objeto_tipo = 'proveedor'
         and i.objeto_id = p.id
       order by i.subida_at
       limit 1),
    'oficios', coalesce((
      select jsonb_agg(jsonb_build_object(
               'oficio_id', po.oficio_id,
               'nombre', c.nombre,
               'grupo', c.grupo,
               'riesgo', c.riesgo,
               'modo', po.modo,
               'precio_desde', po.precio_desde,
               'unidad', po.unidad,
               'publicado', (c.riesgo <> 'alto')
                 or (p.telefono_verificado and exists (
                       select 1 from public.referencias r
                        where r.proveedor_id = p.id and r.estado = 'confirmada'))
               ) order by c.orden)
      from public.proveedor_oficios po
      join public.catalogo_oficios c on c.id = po.oficio_id
      where po.proveedor_id = p.id), '[]'::jsonb),
    'referencias_confirmadas', (
      select count(*) from public.referencias r
       where r.proveedor_id = p.id and r.estado = 'confirmada'),
    'servicios_confirmados', (
      select count(*) from public.servicios_prestados s
       where s.proveedor_id = p.id and s.confirmado_at is not null)
  )
  into v_out
  from public.proveedores p
  where p.id = v_id;

  return v_out;
end;
$function$;

revoke execute on function public.mi_proveedor(text) from public, anon;
grant  execute on function public.mi_proveedor(text) to authenticated;

-- Comprobar, con sesión de alguien que tenga ficha:
--   select public.mi_proveedor() -> 'acepto_foto';
