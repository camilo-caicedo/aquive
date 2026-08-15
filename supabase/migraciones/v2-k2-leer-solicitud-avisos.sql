-- =====================================================================
-- v2 · `leer_solicitud` dice si la solicitud ya tiene avisos
--
-- El ofrecimiento de avisos de la pantalla de confirmación se escondía
-- cuando no debía. Preguntaba `avisosActivosAqui()`, que mira el
-- NAVEGADOR: un teléfono tiene una sola suscripción push, y basta con que
-- exista por el lado de quien ofrece para que parezca que esta solicitud
-- ya está cubierta. No lo está — son dos tablas distintas.
--
-- ⚠ Generada por `migracion/gen-leer-solicitud.mjs` desde la definición
-- real, no escrita a mano.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.leer_solicitud(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_sol  public.solicitudes;
  v_resp jsonb;
  v_items jsonb;
begin
  select * into v_sol from public.solicitudes
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');

  if not found then
    raise exception 'Solicitud no encontrada o vencida';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'id', r.id, 'mensaje', r.mensaje, 'creada_at', r.creada_at,
           'nombre', p.nombre_visible, 'contacto', p.contacto_publico,
           'contacto_tipo', p.contacto_tipo, 'tipo', p.tipo,
           'profesion', sv.profesion, 'verificado', coalesce(sv.verificado, false),
           'puede_llevar', r.puede_llevar
         ) order by r.creada_at desc), '[]'::jsonb)
    into v_resp
    from public.respuestas r
    join public.perfiles p on p.id = r.autor_id
    left join public.servidores sv on sv.perfil_id = p.id
   where r.solicitud_id = v_sol.id and p.suspendido = false;

  -- Mismo left join con coalesce triple que `solicitudes_publicas`: sin él,
  -- el ítem sugerido no aparecería aquí, ni siquiera para quien lo pidió.
  select coalesce(jsonb_agg(jsonb_build_object(
           'nombre',        coalesce(c.nombre, sg.nombre_propuesto),
           'cantidad',      si.cantidad,
           'unidad',        coalesce(c.unidad, sg.unidad_sugerida, 'unidad'),
           'cubierto',      si.cubierto,
           'por_confirmar', si.sugerencia_id is not null
         ) order by coalesce(c.orden, 9999)), '[]'::jsonb)
    into v_items
    from public.solicitud_items si
    left join public.catalogo_items c    on c.id = si.item_id
    left join public.sugerencias_item sg on sg.id = si.sugerencia_id
   where si.solicitud_id = v_sol.id;

  return jsonb_build_object(
    'id', v_sol.id, 'codigo', v_sol.codigo, 'municipio', v_sol.municipio,
    'barrio', v_sol.barrio, 'categoria', v_sol.categoria, 'nota', v_sol.nota,
    'estado', v_sol.estado, 'expira_at', v_sol.expira_at,
    'flujo', v_sol.flujo,
    -- Si ESTA solicitud tiene avisos, que no es lo mismo que si este
    -- navegador tiene una suscripción: un teléfono tiene una sola, y puede
    -- existir por el lado de quien ofrece.
    'tiene_avisos', exists (select 1 from public.push_suscripciones ps
                             where ps.solicitud_id = v_sol.id),
    'puede_recoger', v_sol.puede_recoger,
    -- El NOMBRE de la organización, nunca su identificador ni nada de la
    -- identidad: los datos que entregó no se le vuelven a mostrar.
    'organizacion', (select o.nombre from public.organizaciones o
                      where o.id = v_sol.organizacion_id),
    'items', v_items, 'respuestas', v_resp
  );
end;
$function$
;

grant execute on function public.leer_solicitud(text) to anon, authenticated;
