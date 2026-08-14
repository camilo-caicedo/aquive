-- =====================================================================
-- v2 · Arreglo — quien ofrece puede ver lo que respondió
--
-- Asimetría que estuvo ahí desde el principio y que se nota al usar la
-- plataforma de verdad: quien pide ayuda tiene «Mis solicitudes», y quien
-- ofrece no tenía dónde ver a qué le había respondido. Escribía un
-- mensaje y el mensaje desaparecía de su vista.
--
-- Va por RPC y no por un `select` sobre `respuestas` —que sí tiene
-- política de fila propia— porque hace falta el código, el municipio y el
-- barrio de la solicitud, y `solicitudes` está revocada.
--
-- Solo salen las que siguen vivas: `respuestas` cuelga de `solicitudes`
-- por CASCADE, así que cuando una solicitud se borra a las 72 horas, la
-- respuesta se va con ella. Eso no es un vacío que haya que llenar; es la
-- promesa de borrado funcionando, y la pantalla lo dice.
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
           -- Cuántas respuestas tiene en total: saber que hay otras cinco
           -- personas ofreciendo lo mismo es información útil para quien
           -- está decidiendo si insistir.
           'num_respuestas', (select count(*) from public.respuestas rr
                               where rr.solicitud_id = s.id)
         ) order by r.creada_at desc), '[]'::jsonb)
    from public.respuestas r
    join public.solicitudes s on s.id = r.solicitud_id
    join public.municipios m  on m.codigo_dane = s.municipio
   where r.autor_id = auth.uid();
$$;

revoke execute on function public.mis_respuestas() from public, anon;
grant  execute on function public.mis_respuestas() to authenticated;

comment on function public.mis_respuestas() is
  'Lo que respondió quien ofrece, mientras las solicitudes sigan vivas. No devuelve nada de quien pidió: ni token, ni identidad, ni las otras respuestas — solo cuántas hay.';
