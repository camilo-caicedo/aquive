-- Un aviso agotado (5 intentos) ya no lo entrega `reclamar_avisos`: se
-- abandona a propósito. Un aviso perdido nunca bloquea la escritura.
--
-- Manual, contra la base:  psql -f avisos-abandono.sql
--
-- Va dentro de una transacción que se revierte: inserta un aviso de prueba,
-- comprueba, y deshace todo —incluido cualquier efecto de `reclamar_avisos`
-- sobre otros avisos vivos—. No toca datos reales.

begin;

do $$
declare
  v_id uuid;
  v_n  int;
begin
  insert into public.avisos_pendientes (tipo, payload, intentos)
    values ('respuesta', '{"solicitud_id":"x","codigo":"X"}'::jsonb, 5)
    returning id into v_id;

  select count(*) into v_n from public.reclamar_avisos(50) a where a.id = v_id;

  if v_n <> 0 then
    raise exception 'reclamar_avisos devolvió un aviso con 5 intentos (debía abandonarlo)';
  end if;

  raise notice 'OK: un aviso con 5 intentos queda abandonado';
end $$;

rollback;
