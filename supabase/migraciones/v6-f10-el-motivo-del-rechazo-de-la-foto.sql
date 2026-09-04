-- v6-f10 · `mi_proveedor` dice POR QUÉ se rechazó la foto
--
-- Reporte de alta de ficha, 4 de septiembre de 2026. `foto_estado` ya venía
-- en `mi_proveedor` desde v6-b8, pero solo el estado: quien subía una foto y
-- se la rechazaban veía «rechazada» sin saber qué corregir para volver a
-- intentarlo. `imagenes.motivo` ya existe y ya lo llena quien modera desde
-- `/admin/imagenes` (`comunidad.moderarImagen`) — aquí solo se lee.
--
-- Se recrea la función entera porque `create or replace function` con
-- `returns jsonb` no admite tocar un solo campo del objeto: es la misma
-- firma de v6-f5, con un campo más.
--
-- Idempotente. Se puede volver a correr.

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
    'autorizacion_version', p.autorizacion_version,
    'autorizacion_at', p.autorizacion_at,
    'acepto_mapa', p.acepto_mapa,
    'mapa_version', p.mapa_version,
    'mapa_at', p.mapa_at,
    'acepto_foto', p.acepto_foto,
    'foto_version', p.foto_version,
    'foto_at', p.foto_at,
    'direccion', p.direccion,
    'acepto_direccion', p.acepto_direccion,
    'direccion_version', p.direccion_version,
    'direccion_at', p.direccion_at,
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
    -- Lo que se añade en v6-f10: por qué se rechazó, si se rechazó. NULL en
    -- cualquier otro estado — `en_cola` y `aprobada` no llevan motivo.
    'foto_motivo', (
      select i.motivo
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

comment on function public.mi_proveedor(text) is
  'La ficha propia completa, con lo que no se le enseña a nadie más: el estado y ahora el motivo de rechazo de la foto, y las coordenadas del mapa aunque no estén aceptadas.';
