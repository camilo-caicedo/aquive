-- v6-a2 · Que el chat de servicios se pueda abrir.
--
-- El hilo se crea al abrirlo, y hasta ahora la única pantalla que enlazaba a
-- él era la bandeja — que solo enseña hilos que ya existen. Nadie podía abrir
-- el primero: el chat de servicios llevaba desde el ADR 0003 sin puerta.
--
-- La puerta es el tablero de solicitudes, donde el prestador ya sabe que
-- respondió. Solo falta el id de su respuesta, que es de lo que cuelga el
-- hilo.

create or replace function public.solicitudes_de_servicio(
  p_municipio text default null,
  p_oficio_id text default null,
  p_token text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_prov uuid := public.proveedor_del_llamante(p_token);
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id,
      'codigo', s.codigo,
      'oficio_id', s.oficio_id,
      'oficio_nombre', s.oficio_nombre,
      'grupo', s.grupo,
      'municipio', s.municipio,
      'zona_nombre', s.zona_nombre,
      'zona_texto', s.zona_texto,
      'urgencia', s.urgencia,
      'capacidad_pago', s.capacidad_pago,
      'nota', s.nota,
      'creada_at', s.creada_at,
      'num_respuestas', s.num_respuestas,
      'ya_respondi', v_prov is not null and exists (
        select 1 from public.respuestas_servicio r
         where r.solicitud_id = s.id and r.proveedor_id = v_prov),
      -- De aquí cuelga el hilo. Nulo mientras no haya respondido.
      'mi_respuesta_id', (
        select r.id from public.respuestas_servicio r
         where r.solicitud_id = s.id and r.proveedor_id = v_prov)
    ) order by
        case s.urgencia when 'hoy' then 0 when 'esta_semana' then 1 else 2 end,
        s.creada_at desc)
    from public.solicitudes_servicio_publicas s
    where (p_municipio is null or s.municipio = p_municipio)
      and (p_oficio_id is null or s.oficio_id = p_oficio_id)
  ), '[]'::jsonb);
end;
$function$;
