-- =====================================================================
-- v6 · Fase F · 9 — la otra cola que quedó filtrando por un estado muerto
--
-- `v6-f6` arregló `panel_admin_indice()`, que contaba solicitudes de
-- servicio por `estado = 'abierta'` cuando el ADR 0017 ya había cambiado
-- los estados a `pendiente | aceptada | realizada | rechazada |
-- no_concretada`. Se quedó a medias: `panel_admin_servicios()` —la que
-- llena la pantalla `/admin/servicios`— hace el mismo filtro y nadie lo
-- tocó.
--
-- El efecto es el peor que puede tener una cola de moderación: no falla.
-- Devuelve una lista vacía, siempre, y quien modera lee «no hay nada que
-- revisar» sobre solicitudes que sí están esperando. Un error a la vista se
-- arregla; un cero que miente, no.
--
-- Solo cambia esa condición. El resto de la función se reescribe igual que
-- estaba, porque `create or replace` sustituye el cuerpo entero y no hay
-- forma de tocar una línea suelta.
--
-- ⚠ Lo que NO se cambia, y conviene que quede dicho: `por_verificar`
-- ordena por oficios de riesgo alto primero y, dentro de eso, por
-- `creado_at` ascendente —lo más viejo antes—. Es deliberado: una cola
-- FIFO es la que garantiza que nadie espere indefinidamente. Si una ficha
-- recién creada parece «no estar», casi siempre es que hay fichas de prueba
-- de hace semanas sin verificar delante de ella; eso se arregla atendiendo
-- o borrando esas fichas, no invirtiendo el orden.
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
    --
    -- ⚠ `estado = 'pendiente'`, no `'abierta'`: son los estados del ADR
    -- 0017. Una orden ya aceptada no espera moderación, y una rechazada
    -- tampoco.
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
        and s.estado = 'pendiente'
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
