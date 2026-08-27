-- =====================================================================
-- v6 · Fase B · 5 — la métrica de servicios deja de depender del oficio
--
-- Cola del ADR 0011. `expirar_servicios()` escribe la métrica anónima
-- antes de borrar la solicitud, y la sacaba así:
--
--     from public.solicitudes_servicio s
--     join public.catalogo_oficios o on o.id = s.oficio_id
--     where s.expira_at <= now();
--
--     delete from public.solicitudes_servicio where expira_at <= now();
--
-- El join es INNER. Con `oficio_id` en nulo —que es como nacen todas las
-- solicitudes desde el ADR 0011— la fila no entra en el insert y sí entra
-- en el delete: la solicitud desaparece **sin dejar métrica**, que es la
-- única huella que la regla 3 le permite dejar. Y en silencio.
--
-- `metricas_servicio.oficio` es `not null`, así que no basta con dejarlo
-- en nulo: pasa a guardar el grupo, y el `oficio` deja de existir como
-- dimensión. Es lo honesto — desde el ADR 0011 una solicitud no tiene
-- oficio, tiene categoría y una frase, y una frase no agrupa.
--
-- Las filas viejas no se tocan: `metricas_servicio` es historia, y las que
-- ya están sí distinguían oficio de grupo.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

create or replace function public.expirar_servicios()
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  -- 1. Métrica anónima ANTES del borrado, que es cuando todavía hay de
  --    dónde sacarla. Mismo orden que expirar_solicitudes().
  --
  --    Sin join: el grupo sale de la propia fila. Así no hay manera de que
  --    una solicitud se borre sin dejar su métrica.
  insert into public.metricas_servicio (
    municipio, oficio, grupo, hubo_respuesta, hubo_confirmacion,
    horas_hasta_respuesta, es_prueba
  )
  select s.municipio,
         -- `oficio` es `not null` y ya no hay oficio que poner. Guarda el
         -- grupo, que es la dimensión que sobrevive.
         s.grupo,
         s.grupo,
         exists (select 1 from public.respuestas_servicio r
                  where r.solicitud_id = s.id),
         s.estado = 'resuelta',
         (select round(extract(epoch from (min(r.creada_at) - s.creada_at)) / 3600.0, 1)
            from public.respuestas_servicio r
           where r.solicitud_id = s.id),
         s.es_prueba
  from public.solicitudes_servicio s
  where s.expira_at <= now();

  delete from public.solicitudes_servicio where expira_at <= now();

  -- 2. Un código que nadie usó en 30 días es basura. Los confirmados no
  --    se tocan: sostienen una reseña.
  delete from public.servicios_prestados
   where confirmado_at is null and expira_at <= now();
end;
$function$;

-- Comprobar, con una solicitud ya vencida:
--   select public.expirar_servicios();
--   select municipio, oficio, grupo from public.metricas_servicio
--    order by creada_at desc limit 3;
