-- =====================================================================
-- v2 · Fase A · 1 de 3 — marca de prueba
--
-- Por qué existe esta columna y no basta con borrar por FK:
-- `metricas` no tiene ninguna llave foránea (schema.sql, tabla en la
-- sección 6). `cerrar_solicitud` y `expirar_solicitudes` insertan ahí y
-- después borran la solicitud, así que cada solicitud de prueba que se
-- cierre o venza deja una fila permanente en la tabla que se publica como
-- dato abierto — y para cuando uno quiera limpiarla ya no existe la
-- solicitud que diría cuál era. El CASCADE no la alcanza porque no hay FK.
--
-- Las dos columnas se eliminan cuando termine el periodo de pruebas.
-- Mientras existan, `metricas` se publica siempre con `es_prueba = false`.
--
-- Idempotente: se puede volver a correr sin efecto.
-- =====================================================================

alter table public.solicitudes add column if not exists es_prueba boolean not null default false;
alter table public.metricas    add column if not exists es_prueba boolean not null default false;

comment on column public.solicitudes.es_prueba is
  'La deriva crear_solicitud del prefijo del barrio. Temporal: se elimina al terminar el periodo de pruebas.';
comment on column public.metricas.es_prueba is
  'La propagan cerrar_solicitud y expirar_solicitudes. /datos filtra por es_prueba = false.';

-- ---------------------------------------------------------------------
-- crear_solicitud — deriva la marca del barrio
--
-- `create or replace` y no `drop`: la firma NO cambia en esta migración,
-- así que no se crea ninguna sobrecarga. El `drop` es obligatorio en la
-- Fase F, cuando entra `p_flujo` y sí cambia la firma: agregar un
-- parámetro con `create or replace` deja viva la función de 6 argumentos
-- con su grant a `anon`, y PostgREST devuelve PGRST203 en cada llamada
-- porque no puede elegir entre las dos.
--
-- La marca se deriva del prefijo en vez de recibirse por parámetro por
-- tres razones: no cambia la firma, no se puede olvidar, y hace que una
-- solicitud de prueba creada desde la interfaz real quede marcada sola.
-- El prefijo ya es obligatorio de todos modos, porque `barrio` se ve en
-- la tarjeta del tablero público y quien la vea tiene que entender qué es
-- antes de invertir un viaje.
-- ---------------------------------------------------------------------

create or replace function public.crear_solicitud(
  p_municipio   text,
  p_barrio      text,
  p_categoria   text,
  p_nota        text,
  p_items       jsonb,        -- [{"item_id":"panales_2","cantidad":1}]
  p_token       text          -- generado en el servidor, 32 bytes base64url
)
returns table (solicitud_id uuid, codigo text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id     uuid;
  v_codigo text;
  v_item   jsonb;
begin
  if p_nota is not null and p_nota ~ '(\+?57)?[ -]?3[0-9]{9}|[0-9]{7,}|@[a-zA-Z0-9._-]+\.[a-z]{2,}' then
    raise exception 'La nota no puede contener teléfonos ni correos';
  end if;

  if jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 12 then
    raise exception 'Debe incluir entre 1 y 12 ítems';
  end if;

  v_codigo := public.generar_codigo();

  insert into public.solicitudes (codigo, token_hash, municipio, barrio, categoria, nota, es_prueba)
  values (v_codigo, encode(extensions.digest(p_token, 'sha256'), 'hex'),
          p_municipio, p_barrio, p_categoria, nullif(trim(p_nota), ''),
          trim(p_barrio) ilike 'prueba%')
  returning id into v_id;

  for v_item in select * from jsonb_array_elements(p_items) loop
    insert into public.solicitud_items (solicitud_id, item_id, cantidad)
    values (v_id, v_item->>'item_id', (v_item->>'cantidad')::numeric);
  end loop;

  return query select v_id, v_codigo;
end;
$$;

grant execute on function public.crear_solicitud(text,text,text,text,jsonb,text) to anon, authenticated;

-- ---------------------------------------------------------------------
-- cerrar_solicitud — propaga la marca a la métrica que sobrevive
-- ---------------------------------------------------------------------

create or replace function public.cerrar_solicitud(p_token text, p_cumplida boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare v_sol public.solicitudes;
begin
  select * into v_sol from public.solicitudes
   where token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex');
  if not found then raise exception 'Solicitud no encontrada'; end if;

  insert into public.metricas (
    municipio, categoria, cumplida, horas_hasta_respuesta,
    horas_hasta_cierre, num_respuestas, es_prueba)
  select v_sol.municipio, v_sol.categoria, p_cumplida,
         extract(epoch from (min(r.creada_at) - v_sol.creada_at)) / 3600,
         extract(epoch from (now() - v_sol.creada_at)) / 3600,
         count(r.id), v_sol.es_prueba
    from public.respuestas r where r.solicitud_id = v_sol.id;

  delete from public.solicitudes where id = v_sol.id;   -- CASCADE limpia todo
end;
$$;

grant execute on function public.cerrar_solicitud(text, boolean) to anon, authenticated;

-- ---------------------------------------------------------------------
-- expirar_solicitudes — propaga la marca
--
-- NO la llames a mano: no tiene filtro y borra todo lo vencido en ese
-- instante. La corre el job de pg_cron cada hora.
-- ---------------------------------------------------------------------

create or replace function public.expirar_solicitudes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_n integer;
begin
  insert into public.metricas (
    municipio, categoria, cumplida, horas_hasta_respuesta,
    horas_hasta_cierre, num_respuestas, es_prueba)
  select s.municipio, s.categoria, false,
         extract(epoch from (min(r.creada_at) - s.creada_at)) / 3600,
         extract(epoch from (s.expira_at - s.creada_at)) / 3600,
         count(r.id), s.es_prueba
    from public.solicitudes s
    left join public.respuestas r on r.solicitud_id = s.id
   where s.expira_at <= now()
   group by s.id, s.municipio, s.categoria, s.creada_at, s.expira_at, s.es_prueba;

  delete from public.solicitudes where expira_at <= now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke execute on function public.expirar_solicitudes() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Las solicitudes de prueba que ya existían, antes de que hubiera columna
-- ---------------------------------------------------------------------

update public.solicitudes
   set es_prueba = true
 where trim(barrio) ilike 'prueba%'
   and es_prueba = false;

-- Comprobar:
--   select codigo, barrio, es_prueba from public.solicitudes order by creada_at;
--   select count(*) from public.metricas where es_prueba;
