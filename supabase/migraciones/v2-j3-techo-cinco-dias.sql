-- =====================================================================
-- v2 · El techo de la auto-renovación baja de 14 días a 5
--
-- El techo existe desde `v2-i1` y su razón no cambia: una solicitud con
-- coordinación abierta se auto-renueva para que no se borre en mitad de
-- una entrega, pero no puede renovarse para siempre — una conversación
-- estancada mantendría viva una identidad cifrada indefinidamente, y la
-- promesa del proyecto es que esto se borra.
--
-- Lo que cambia es el número, y conviene decir de dónde salía: de ningún
-- sitio. `PLAN-V2.md` §5.7-3 justifica que HAYA techo, nunca que sean
-- catorce. Era una estimación de escritorio.
--
-- Cinco días los pone quien opera esto: si una entrega de emergencia no se
-- concreta en cinco días, lo que hay no es una coordinación lenta sino una
-- que no va a ocurrir, y mientras tanto hay un nombre y un documento
-- guardados esperándola.
--
-- ⚠ Este archivo NO está escrito a mano: lo genera
-- `migracion/gen-techo.mjs` desde la definición que hay en la base,
-- cambiando solo el intervalo. La función decide qué se borra y cuándo.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.expirar_solicitudes()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_n integer;
begin
  -- 1 · Lo que sigue vivo se renueva solo.
  update public.solicitudes s
     set expira_at = now() + interval '72 hours'
   where s.expira_at <= now()
     and s.creada_at > now() - interval '5 days'
     and exists (select 1 from public.conversaciones c
                  where c.solicitud_id = s.id and c.estado <> 'cerrada');

  -- 2 · Lo que llegó al techo se cierra antes de borrarse, para que el
  -- hilo no desaparezca a mitad de una frase.
  update public.conversaciones c
     set estado = 'cerrada', cerrada_at = now()
   where c.estado <> 'cerrada'
     and exists (select 1 from public.solicitudes s
                  where s.id = c.solicitud_id and s.expira_at <= now());

  -- 3 · La métrica, ahora sin mentir: `entregada_parcial` y `cumplida`
  -- cuentan como cumplidas, porque hubo entrega.
  insert into public.metricas (
    municipio, categoria, cumplida, horas_hasta_respuesta,
    horas_hasta_cierre, num_respuestas, es_prueba, flujo, con_aliado)
  select s.municipio, s.categoria,
         s.estado in ('cumplida','entregada_parcial'),
         extract(epoch from (min(r.creada_at) - s.creada_at)) / 3600,
         extract(epoch from (s.expira_at - s.creada_at)) / 3600,
         count(r.id), s.es_prueba, s.flujo,
         exists (select 1 from public.conversaciones c
                  where c.solicitud_id = s.id and c.aliado_id is not null)
    from public.solicitudes s
    left join public.respuestas r on r.solicitud_id = s.id
   where s.expira_at <= now()
   group by s.id, s.municipio, s.categoria, s.creada_at, s.expira_at,
            s.es_prueba, s.flujo, s.estado;

  delete from public.solicitudes where expira_at <= now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$function$
;

revoke execute on function public.expirar_solicitudes() from public, anon, authenticated;

-- Comprobar (sin ejecutarla — regla 5, nunca a mano):
--   select prosrc like '%interval ''5 days''%' as techo_en_cinco
--     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public' and p.proname = 'expirar_solicitudes';
