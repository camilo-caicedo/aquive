-- =====================================================================
-- v2 · L1 · Límite de tasa (y, desde commit 5, cola de avisos)
--
-- Dos responsabilidades salen del camino de la petición y bajan a
-- Postgres. Este archivo se llena en dos pasos:
--   · Commit 4 (este bloque): límite de tasa — `limites_tasa`,
--     `consumir_limite`, purga horaria.
--   · Commit 5: la cola transaccional de avisos —`avisos_pendientes`,
--     sus RPC y el drenado por `pg_cron`→`pg_net`— se AÑADE debajo.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Límite de tasa: ventana fija, clave hasheada con pepper, autopurga.
--
-- La clave (nombre de ruta + IP del cliente) nunca se guarda en claro:
-- se hashea con el pepper del Vault, igual que un documento (regla 6, sin
-- PII en la base). La tabla es efímera —se purga cada hora— y no cuelga
-- de nada: es telemetría de seguridad, no un dato de solicitud.
-- ---------------------------------------------------------------------

create table if not exists public.limites_tasa (
  clave          text primary key,
  ventana_inicio timestamptz not null default now(),
  conteo         int not null default 0
);
alter table public.limites_tasa enable row level security;  -- sin políticas: cerrada

-- La llama `limitar()` desde el backend con el rol de servicio. Revocada de
-- todo lo demás: anon y authenticated no la ven, solo service_role la
-- ejecuta (por los privilegios por defecto de Supabase, que sobreviven al
-- revoke de public).
create or replace function public.consumir_limite(p_clave text, p_max int, p_ventana_seg int)
  returns boolean
  language plpgsql security definer set search_path = ''
  as $$
  declare v_hash text; v_conteo int;
  begin
    v_hash := public.hash_con_pepper(p_clave);  -- nunca se guarda la IP en claro
    insert into public.limites_tasa (clave, ventana_inicio, conteo)
      values (v_hash, now(), 1)
    on conflict (clave) do update set
      ventana_inicio = case when public.limites_tasa.ventana_inicio
                             < now() - make_interval(secs => p_ventana_seg)
                            then now() else public.limites_tasa.ventana_inicio end,
      conteo = case when public.limites_tasa.ventana_inicio
                         < now() - make_interval(secs => p_ventana_seg)
                        then 1 else public.limites_tasa.conteo + 1 end
    returning conteo into v_conteo;
    return v_conteo <= p_max;
  end $$;
revoke execute on function public.consumir_limite(text,int,int) from public, anon, authenticated;

comment on function public.consumir_limite(text,int,int) is
  'Ventana fija de límite de tasa. Devuelve true si el cliente puede continuar. La clave se hashea con pepper del Vault: la IP nunca se guarda en claro (regla 6). La llama limitar() con el rol de servicio.';

-- Purga horaria: una ventana de más de una hora ya no le sirve a nadie.
-- cron.schedule upserta por nombre, así que re-correr el esquema es seguro.
select cron.schedule('purgar-limites', '0 * * * *',
  $$delete from public.limites_tasa where ventana_inicio < now() - interval '1 hour'$$);
