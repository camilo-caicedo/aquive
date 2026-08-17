-- =====================================================================
-- v2 · el departamento viaja pegado al nombre del municipio
--
-- Hay municipios que se llaman igual en departamentos distintos: Albán
-- está en Cundinamarca y en Nariño, y no es el único. «Albán» a secas no
-- dice a dónde hay que llevar nada.
--
-- El campo se llama `municipio` y es el que se pinta, así que lleva el
-- texto completo. Los identificadores no se tocan: para comparar y para
-- filtrar se sigue usando `codigo_dane`.
--
-- ⚠ Generada por `migracion/gen-municipio-departamento.mjs` desde las
-- definiciones reales, no escrita a mano.
--
-- Idempotente: el generador se niega a correr si ya está aplicada.
-- =====================================================================

create or replace view public.solicitudes_publicas as
 SELECT s.id,
    s.codigo,
    s.municipio,
    m.nombre || ', ' || m.departamento AS municipio_nombre,
    s.barrio,
    s.categoria,
    s.nota,
    s.creada_at,
    s.confirmada_at,
    s.expira_at,
    EXTRACT(epoch FROM now() - s.confirmada_at) / 3600::numeric AS horas_sin_confirmar,
    ( SELECT count(*) AS count
           FROM respuestas r
          WHERE r.solicitud_id = s.id) AS num_respuestas,
    ( SELECT COALESCE(jsonb_agg(jsonb_build_object('nombre', COALESCE(c.nombre, sg.nombre_propuesto), 'cantidad', si.cantidad, 'unidad', COALESCE(c.unidad, sg.unidad_sugerida, 'unidad'::text), 'por_confirmar', si.sugerencia_id IS NOT NULL) ORDER BY (COALESCE(c.orden, 9999))), '[]'::jsonb) AS "coalesce"
           FROM solicitud_items si
             LEFT JOIN catalogo_items c ON c.id = si.item_id
             LEFT JOIN sugerencias_item sg ON sg.id = si.sugerencia_id
          WHERE si.solicitud_id = s.id) AS items,
    ( SELECT COALESCE(array_agg(si.item_id) FILTER (WHERE si.item_id IS NOT NULL), '{}'::text[]) AS "coalesce"
           FROM solicitud_items si
          WHERE si.solicitud_id = s.id) AS item_ids,
    ( SELECT COALESCE(array_agg(si.sugerencia_id) FILTER (WHERE si.sugerencia_id IS NOT NULL), '{}'::uuid[]) AS "coalesce"
           FROM solicitud_items si
          WHERE si.solicitud_id = s.id) AS sugerencia_ids,
    s.flujo,
    s.nota_admin
   FROM solicitudes s
     JOIN municipios m ON m.codigo_dane = s.municipio
  WHERE estado_activo(s.estado) AND s.expira_at > now();

CREATE OR REPLACE FUNCTION public.mis_hilos()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(jsonb_agg(x order by x->>'creada_at' desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'id',            c.id,
        'estado',        c.estado,
        'creada_at',     c.creada_at,
        'codigo',        s.codigo,
        'municipio',     m.nombre || ', ' || m.departamento,
        'barrio',        s.barrio,
        'directa',       c.directa,
        -- `coalesce` y no la comparación pelada: en un hilo directo
        -- `ofertador_id` es nulo, y `null = uuid` da NULL, no false. Sin
        -- esto el campo llega como null al navegador y `soy_ofertador`
        -- deja de ser un booleano.
        'soy_ofertador', coalesce(c.ofertador_id = auth.uid(), false),
        'ofertador',     (select p.nombre_visible from public.perfiles p where p.id = c.ofertador_id),
        'aliado',        (select p.nombre_visible from public.perfiles p where p.id = c.aliado_id),
        'sin_asignar',   c.aliado_id is null,
        'mensajes_total',(select count(*) from public.mensajes mm where mm.conversacion_id = c.id)
      ) as x
      from public.conversaciones c
      join public.solicitudes s on s.id = c.solicitud_id
      join public.municipios m  on m.codigo_dane = s.municipio
     where c.ofertador_id = auth.uid()
        or public.es_miembro_activo(c.organizacion_id, auth.uid())
    ) t;
$function$
;

grant execute on function public.mis_hilos() to authenticated;

CREATE OR REPLACE FUNCTION public.solicitudes_de_mi_organizacion()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(jsonb_agg(x order by x->>'creada_at'), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'solicitud_id',  s.id,
        'codigo',        s.codigo,
        'municipio',     m.nombre || ', ' || m.departamento,
        'barrio',        s.barrio,
        'categoria',     s.categoria,
        'nota',          s.nota,
        'creada_at',     s.creada_at,
        'puede_recoger', s.puede_recoger,
        -- Cuántos hilos vivos tiene ya: si alguien más está trayendo esto,
        -- la fundación decide distinto.
        'hilos',         (select count(*) from public.conversaciones c
                           where c.solicitud_id = s.id and c.estado <> 'cerrada'),
        'pendientes',    (select coalesce(jsonb_agg(jsonb_build_object(
                                  'nombre',   coalesce(ci.nombre, sg.nombre_propuesto),
                                  'cantidad', si.cantidad,
                                  'unidad',   coalesce(ci.unidad, sg.unidad_sugerida, 'unidad')
                                ) order by coalesce(ci.orden, 9999)), '[]'::jsonb)
                            from public.solicitud_items si
                            left join public.catalogo_items ci   on ci.id = si.item_id
                            left join public.sugerencias_item sg on sg.id = si.sugerencia_id
                           where si.solicitud_id = s.id and si.cubierto = false)
      ) as x
      from public.solicitudes s
      join public.municipios m on m.codigo_dane = s.municipio
     where s.flujo = 'acompanado'
       and public.estado_activo(s.estado)
       and s.expira_at > now()
       and public.es_miembro_activo(s.organizacion_id, auth.uid())
       and exists (select 1 from public.solicitud_items si
                    where si.solicitud_id = s.id and si.cubierto = false)
       and not exists (select 1 from public.conversaciones c
                        where c.solicitud_id = s.id and c.directa)
    ) t;
$function$
;

grant execute on function public.solicitudes_de_mi_organizacion() to authenticated;

CREATE OR REPLACE FUNCTION public.solicitudes_admin()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case when not public.es_admin(auth.uid()) then '[]'::jsonb
         else coalesce((
           select jsonb_agg(jsonb_build_object(
             'codigo',      s.codigo,
             'municipio',   m.nombre || ', ' || m.departamento,
             'barrio',      s.barrio,
             'categoria',   s.categoria,
             'nota',        s.nota,
             'nota_admin',  s.nota_admin,
             'estado',      s.estado,
             'creada_at',   s.creada_at,
             'expira_at',   s.expira_at,
             'respuestas',  (select count(*) from public.respuestas r where r.solicitud_id = s.id),
             'items',       (select coalesce(jsonb_agg(jsonb_build_object(
                                      'nombre',   coalesce(ci.nombre, sg.nombre_propuesto),
                                      'cantidad', si.cantidad,
                                      'unidad',   coalesce(ci.unidad, sg.unidad_sugerida, 'unidad'))
                                    order by coalesce(ci.orden, 9999)), '[]'::jsonb)
                               from public.solicitud_items si
                               left join public.catalogo_items ci   on ci.id = si.item_id
                               left join public.sugerencias_item sg on sg.id = si.sugerencia_id
                              where si.solicitud_id = s.id)
           ) order by s.creada_at desc)
             from public.solicitudes s
             join public.municipios m on m.codigo_dane = s.municipio
         ), '[]'::jsonb)
         end;
$function$
;

grant execute on function public.solicitudes_admin() to authenticated;

CREATE OR REPLACE FUNCTION public.coincidencias_para_aliado()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(jsonb_agg(x order by x->>'items_coincidentes' desc), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'solicitud_id',       v.solicitud_id,
        'codigo',             v.codigo,
        'municipio',          m.nombre || ', ' || m.departamento,
        'ofertador_id',       v.ofertador_id,
        'ofertador',          p.nombre_visible,
        'items_coincidentes', v.items_coincidentes,
        'detalle',            v.detalle,
        -- Si ya hay hilo con ese ofertador, el panel muestra «ya está en
        -- conversación» en vez de invitar otra vez.
        'ya_hay_hilo',        exists (select 1 from public.conversaciones c
                                       where c.solicitud_id = v.solicitud_id
                                         and c.ofertador_id = v.ofertador_id)
      ) as x
      from public.v_cruces v
      join public.municipios m on m.codigo_dane = v.municipio
      join public.perfiles p   on p.id = v.ofertador_id
      -- Las tres condiciones de §5.4, y la tercera es la que importa: sin
      -- ella el aliado vería solicitudes ANÓNIMAS del Flujo 1 en su panel,
      -- y el botón de conectar arrastraría a un solicitante que nunca
      -- aceptó nada a un hilo interno. Violaría la regla 3 y la R de golpe.
      where v.flujo = 'acompanado'
        and public.es_miembro_activo(v.organizacion_id, auth.uid())
    ) t;
$function$
;

grant execute on function public.coincidencias_para_aliado() to authenticated;

CREATE OR REPLACE FUNCTION public.panel_admin_flujo2()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select case when not public.es_admin(auth.uid()) then '{}'::jsonb
  else jsonb_build_object(
    'sin_aliado', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id',        c.id,
               'codigo',    s.codigo,
               'municipio', m.nombre || ', ' || m.departamento,
               'creada_at', c.creada_at
             ) order by c.creada_at), '[]'::jsonb)
        from public.conversaciones c
        join public.solicitudes s on s.id = c.solicitud_id
        join public.municipios m  on m.codigo_dane = s.municipio
       where c.estado = 'esperando_aliado'),
    -- Sin PII: quién leyó, cuándo y por qué. Nunca qué leyó.
    'accesos', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'rol',    a.rol_lector,
               'motivo', a.motivo,
               'cuando', a.leida_at,
               'huerfano', a.identidad_id is null
             ) order by a.leida_at desc), '[]'::jsonb)
        from (select * from public.accesos_identidad
               order by leida_at desc limit 50) a),
    'hilos_abiertos', (select count(*) from public.conversaciones
                        where estado not in ('cerrada','entregada'))
  ) end;
$function$
;

grant execute on function public.panel_admin_flujo2() to authenticated;

CREATE OR REPLACE FUNCTION public.mis_datos(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_sol   public.solicitudes;
  v_ident public.identidades;
begin
  select * into v_sol from public.solicitudes s
   where s.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  if v_sol.id is null then
    raise exception 'Solicitud no encontrada o vencida';
  end if;

  select * into v_ident from public.identidades i where i.solicitud_id = v_sol.id;

  return jsonb_build_object(
    'codigo',      v_sol.codigo,
    'flujo',       v_sol.flujo,
    'municipio',   (select m.nombre || ', ' || m.departamento from public.municipios m
                     where m.codigo_dane = v_sol.municipio),
    'barrio',      v_sol.barrio,
    'nota',        v_sol.nota,
    'creada_at',   v_sol.creada_at,
    'expira_at',   v_sol.expira_at,
    'organizacion', (select o.nombre from public.organizaciones o
                      where o.id = v_sol.organizacion_id),
    'identidad', case when v_ident.id is null then null else jsonb_build_object(
      'documento_tipo',       v_ident.documento_tipo,
      'documento_ultimos4',   v_ident.documento_ultimos4,
      'tiene_telefono',       v_ident.telefono_cifrado is not null,
      'autorizacion_version', v_ident.autorizacion_version,
      'autorizacion_at',      v_ident.autorizacion_at
    ) end,
    -- Quién ha visto esos datos, cuándo y con qué motivo. Es el derecho a
    -- saber, y es exactamente para lo que existe `accesos_identidad`.
    'accesos', case when v_ident.id is null then '[]'::jsonb else (
      select coalesce(jsonb_agg(jsonb_build_object(
               'rol',    a.rol_lector,
               'motivo', a.motivo,
               'cuando', a.leida_at
             ) order by a.leida_at desc), '[]'::jsonb)
        from public.accesos_identidad a where a.identidad_id = v_ident.id) end,
    'entregas', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'item',       coalesce(c.nombre, sg.nombre_propuesto),
               'cantidad',   e.cantidad,
               'unidad',     coalesce(c.unidad, sg.unidad_sugerida, 'unidad'),
               'confirmada', e.confirmada_por_solicitante_at is not null
             ) order by e.recibido_at), '[]'::jsonb)
        from public.entregas e
        left join public.catalogo_items c    on c.id = e.item_id
        left join public.sugerencias_item sg on sg.id = e.sugerencia_id
       where e.solicitud_codigo = v_sol.codigo)
  );
end;
$function$
;

grant execute on function public.mis_datos(p_token text) to anon, authenticated;
