-- =====================================================================
-- v6 · Fase B · 6 — la cola de solicitudes por revisar
--
-- ADR 0011: la solicitud se publica de inmediato y se revisa después.
-- Quien pide necesita respuesta hoy, y este módulo nació de una
-- emergencia; hacer esperar a alguien horas a que un humano apruebe su
-- «necesito que me cuiden a mi mamá esta tarde» es peor que el riesgo de
-- que se cuele un texto feo durante un rato.
--
-- Lo que sostiene el suelo mientras nadie ha mirado no es la confianza:
-- es `validarNota` en el servidor, que rechaza el envío con motivo, más
-- los 80 caracteres del CHECK. Y sobre la lista pública no hay ni un dato
-- de quien pidió, así que un texto malintencionado no lleva a nadie a
-- ninguna parte.
--
-- `panel_admin_servicios()` gana la lista. La cola vive en /admin/servicios
-- y no en una ruta nueva: es la quinta de las que ya están ahí.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

create or replace function public.panel_admin_servicios()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  return jsonb_build_object(
    'por_verificar', coalesce((
      select jsonb_agg(x order by (x->>'oficios_esperando')::int desc,
                                  x->>'creado_at')
      from (
        select jsonb_build_object(
          'id', p.id,
          'nombre_visible', p.nombre_visible,
          'telefono', p.telefono,
          'municipio', p.municipio,
          'creado_at', p.creado_at,
          'organizacion', o.nombre,
          'oficios_esperando', (
            select count(*)
            from public.proveedor_oficios po
            join public.catalogo_oficios c on c.id = po.oficio_id
            where po.proveedor_id = p.id and c.riesgo = 'alto')
        ) as x
        from public.proveedores p
        left join public.organizaciones o on o.id = p.organizacion_id
        where not p.telefono_verificado and not p.suspendido
      ) s), '[]'::jsonb),

    'suspendidos', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'nombre_visible', p.nombre_visible,
        'municipio', p.municipio,
        'actualizado_at', p.actualizado_at
      ) order by p.actualizado_at desc)
      from public.proveedores p where p.suspendido), '[]'::jsonb),

    'resenas_ocultas', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'proveedor_id', r.proveedor_id,
        'proveedor_nombre', p.nombre_visible,
        'comentario', r.comentario,
        'replica', r.replica,
        'creada_at', r.creada_at
      ) order by r.creada_at desc)
      from public.resenas r
      join public.proveedores p on p.id = r.proveedor_id
      where r.oculta), '[]'::jsonb),

    -- Lo que nadie ha mirado, lo más viejo primero. Sin nada de quien
    -- pidió: se modera un texto, no una persona. El código sirve para
    -- reconocerla si alguien llama preguntando.
    'solicitudes_por_revisar', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'codigo', s.codigo,
        'grupo', s.grupo,
        'detalle', s.detalle,
        'nota', s.nota,
        'municipio', m.nombre,
        'creada_at', s.creada_at
      ) order by s.creada_at)
      from public.solicitudes_servicio s
      join public.municipios m on m.codigo_dane = s.municipio
      where s.revisada_at is null
        and s.estado = 'abierta'
        and s.expira_at > now()), '[]'::jsonb),

    'referencias_pendientes', (
      select count(*) from public.referencias r where r.estado = 'pendiente'),

    'zonas_pendientes', (
      select count(*) from public.zonas z where z.estado = 'propuesta'),

    'totales', jsonb_build_object(
      'proveedores', (select count(*) from public.proveedores),
      'publicados', (select count(*) from public.proveedores_publicos),
      'solicitudes', (select count(*) from public.solicitudes_servicio),
      'servicios_confirmados', (
        select count(*) from public.servicios_prestados
         where confirmado_at is not null))
  );
end;
$function$;

revoke execute on function public.panel_admin_servicios() from public, anon;
grant  execute on function public.panel_admin_servicios() to authenticated;

-- Comprobar:
--   select jsonb_pretty(public.panel_admin_servicios() -> 'solicitudes_por_revisar');
