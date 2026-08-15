-- =====================================================================
-- v2 · Arreglo — las respuestas que quedaron antes del acompañamiento
--
-- El hueco: una solicitud se publica directa, alguien responde, y DESPUÉS
-- quien pidió activa el acompañamiento. A partir de ese momento la
-- coordinación ocurre dentro de la plataforma… pero quien ya había
-- respondido no se entera, y la fundación no ve a nadie.
--
-- Pasó dos veces seguidas probando el recorrido completo, que es la
-- definición de un hueco y no de un descuido: el orden natural de una
-- persona es ofrecer primero y pedir acompañamiento después, cuando ve que
-- la cosa se pone seria.
--
-- §7 ya decía que las respuestas del flujo directo se conservan. Lo que
-- faltaba era que alguien pudiera hacer algo con ellas.
--
-- Dos cambios, uno por cada lado:
--   · `mis_respuestas` dice si esa solicitud ya tiene hilo con esa
--     persona, para poder ofrecerle abrir la conversación.
--   · `respuestas_por_coordinar` le muestra a la fundación quién ya
--     ofreció ayuda en sus solicitudes acompañadas y todavía no está en
--     ninguna conversación.
--
-- ⚠ Lo que NO se hace: crear los hilos solos al activar el
-- acompañamiento. Sería meter a alguien en una conversación sin
-- preguntarle, y el primer mensaje sería suyo sin haberlo escrito. La
-- invitación la manda la fundación, o la abre quien ofreció.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

create or replace function public.mis_respuestas()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id',           r.id,
           'mensaje',      r.mensaje,
           'creada_at',    r.creada_at,
           'codigo',       s.codigo,
           'municipio',    m.nombre,
           'barrio',       s.barrio,
           'categoria',    s.categoria,
           'flujo',        s.flujo,
           'expira_at',    s.expira_at,
           'num_respuestas', (select count(*) from public.respuestas rr
                               where rr.solicitud_id = s.id),
           -- Para poder decirle «esta solicitud ahora la acompaña una
           -- fundación, abre la conversación» solo a quien le falta.
           'tiene_hilo',   exists (select 1 from public.conversaciones c
                                    where c.solicitud_id = s.id
                                      and c.ofertador_id = r.autor_id)
         ) order by r.creada_at desc), '[]'::jsonb)
    from public.respuestas r
    join public.solicitudes s on s.id = r.solicitud_id
    join public.municipios m  on m.codigo_dane = s.municipio
   where r.autor_id = auth.uid();
$$;

revoke execute on function public.mis_respuestas() from public, anon;
grant  execute on function public.mis_respuestas() to authenticated;

-- Quién ya dijo «puedo ayudar» en una solicitud acompañada de mi
-- organización y todavía no está en ninguna conversación.
--
-- Es mejor señal que el cruce por inventario: esa persona no solo tiene la
-- cosa, ya se ofreció para ESTA solicitud. Devuelve la misma forma que
-- `coincidencias_para_aliado` —más el mensaje que escribió— para que el
-- panel las trate igual y el botón de invitar sea el mismo.
create or replace function public.respuestas_por_coordinar()
returns jsonb
language sql
security definer
stable
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'solicitud_id',       s.id,
           'codigo',             s.codigo,
           'municipio',          m.nombre,
           'ofertador_id',       p.id,
           'ofertador',          p.nombre_visible,
           'mensaje',            r.mensaje,
           'items_coincidentes', 0,
           'detalle',            '[]'::jsonb,
           'ya_hay_hilo',        false
         ) order by r.creada_at), '[]'::jsonb)
    from public.respuestas r
    join public.solicitudes s on s.id = r.solicitud_id
    join public.perfiles p    on p.id = r.autor_id
    join public.municipios m  on m.codigo_dane = s.municipio
   where s.flujo = 'acompanado'
     and public.estado_activo(s.estado)
     and s.expira_at > now()
     and p.suspendido = false
     and public.es_miembro_activo(s.organizacion_id, auth.uid())
     and not exists (select 1 from public.conversaciones c
                      where c.solicitud_id = s.id
                        and c.ofertador_id = r.autor_id);
$$;

revoke execute on function public.respuestas_por_coordinar() from public, anon;
grant  execute on function public.respuestas_por_coordinar() to authenticated;

comment on function public.respuestas_por_coordinar() is
  'Quien ya ofreció ayuda en una solicitud acompañada de mi organización y todavía no está en un hilo. Devuelve la misma forma que coincidencias_para_aliado para que el panel y el botón de invitar sean los mismos.';
