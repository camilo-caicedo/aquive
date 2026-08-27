-- =====================================================================
-- v6 · Fase B · 2 — las otras tres funciones que quedaron rotas
--
-- Al arreglar `panel_admin_indice()` en `v6-b1` se buscó el nombre de las
-- tablas borradas en TODOS los cuerpos de función, que es lo que había
-- que haber hecho al borrarlas:
--
--   select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.prosrc ~ '(conversaciones|accesos_identidad|\midentidades\M)';
--
-- Salieron cuatro más. Dos de ellas no las llama nadie y se borran; las
-- otras dos SÍ se usan y llevaban rotas desde el ADR 0007, cada una con
-- su consecuencia:
--
-- · `expirar_solicitudes()` es el cron que hace cumplir la regla de
--   producto 3 —una solicitud de insumos vive 72 h—. Rota, no expiraba
--   ninguna: las solicitudes de prueba llevan semanas vivas y sus
--   métricas nunca se escribieron.
--
-- · `resolver_reporte()` es lo que pulsa quien modera un reporte. Rota,
--   un reporte de una solicitud no se podía atender: la función se caía
--   antes de marcar `atendido`.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1 · Las dos que ya no llama nadie
--
-- `bloquear_ofertador` era del hilo de tres. `panel_admin_flujo2` era el
-- panel de ese flujo, y su bitácora la reemplazó `bitacora_accesos()`.
-- ---------------------------------------------------------------------

drop function if exists public.bloquear_ofertador(uuid, text);
drop function if exists public.panel_admin_flujo2();

-- ---------------------------------------------------------------------
-- 2 · El cron de expiración
--
-- Se le caen dos pasos enteros, y conviene decir por qué y no solo que sí:
--
-- · La renovación automática —«si el hilo sigue abierto, dale 72 h más»—
--   se va. Era del flujo acompañado, donde una fundación podía tardar en
--   contestar y no era culpa de quien pedía. Hoy renovar es un botón de
--   quien publicó, en `/mis-solicitudes`, y una solicitud que nadie
--   renueva es una solicitud que ya no hace falta.
--
-- · Cerrar los hilos antes de borrar tampoco hace falta. El chat de hoy
--   cuelga de la respuesta por `chats.respuesta_insumo_id` con
--   `on delete cascade`, y `respuestas.solicitud_id` cascadea también:
--   borrar la solicitud borra sus respuestas y con ellas sus hilos. Es
--   exactamente lo que pide la regla de producto 3 —el chat muere con lo
--   que lo abrió—, y lo sostiene la base, no esta función.
--
-- La métrica se queda, que es lo único que sobrevive al borrado. Ya no
-- escribe `flujo` ni `con_aliado`: `solicitudes.flujo` no existe desde el
-- ADR 0007 y las columnas de `metricas` tienen valor por defecto
-- —'directo' y false—, que es la verdad de todas las solicitudes de ahora.
-- Las columnas no se tocan: `metricas` guarda historia y las filas viejas
-- sí distinguían.
-- ---------------------------------------------------------------------

create or replace function public.expirar_solicitudes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_n integer;
begin
  -- La métrica ANTES del borrado, que es la única huella que queda.
  -- `entregada_parcial` cuenta como cumplida: hubo entrega.
  insert into public.metricas (
    municipio, categoria, cumplida, horas_hasta_respuesta,
    horas_hasta_cierre, num_respuestas, es_prueba)
  select s.municipio, s.categoria,
         s.estado in ('cumplida','entregada_parcial'),
         extract(epoch from (min(r.creada_at) - s.creada_at)) / 3600,
         extract(epoch from (s.expira_at - s.creada_at)) / 3600,
         count(r.id), s.es_prueba
    from public.solicitudes s
    left join public.respuestas r on r.solicitud_id = s.id
   where s.expira_at <= now()
   group by s.id, s.municipio, s.categoria, s.creada_at, s.expira_at,
            s.es_prueba, s.estado;

  delete from public.solicitudes where expira_at <= now();
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------
-- 3 · Resolver un reporte
--
-- Mismo cambio y por la misma razón: no hay hilos que cerrar a mano, y la
-- métrica pierde las dos columnas del flujo. Lo demás queda igual —qué se
-- borra de verdad y qué solo se retira o se suspende— porque eso no lo
-- decidió el ADR 0007 y no le toca cambiar aquí.
-- ---------------------------------------------------------------------

create or replace function public.resolver_reporte(p_reporte_id uuid, p_borrar boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rep public.reportes;
  v_sol public.solicitudes;
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  select * into v_rep from public.reportes where id = p_reporte_id;
  if not found then raise exception 'Reporte no encontrado'; end if;

  if p_borrar then
    if v_rep.tipo_objeto = 'solicitud' then
      select * into v_sol from public.solicitudes where id = v_rep.objeto_id;

      if v_sol.id is not null then
        -- La métrica primero: sin ella no queda ni rastro de que existió.
        insert into public.metricas (
          municipio, categoria, cumplida, horas_hasta_respuesta,
          horas_hasta_cierre, num_respuestas, es_prueba)
        select v_sol.municipio, v_sol.categoria, false,
               extract(epoch from (min(r.creada_at) - v_sol.creada_at)) / 3600,
               extract(epoch from (now() - v_sol.creada_at)) / 3600,
               count(r.id), v_sol.es_prueba
          from public.respuestas r where r.solicitud_id = v_sol.id;

        -- Y el borrado, que arrastra respuestas y sus hilos por cascada.
        delete from public.solicitudes where id = v_sol.id;
      end if;

    elsif v_rep.tipo_objeto = 'respuesta' then
      delete from public.respuestas where id = v_rep.objeto_id;
    elsif v_rep.tipo_objeto = 'perfil' then
      update public.perfiles set suspendido = true where id = v_rep.objeto_id;
    elsif v_rep.tipo_objeto = 'entidad' then
      -- Se retira, no se borra: si el enlace se recupera, se vuelve a subir
      -- sin tener que escribir la ficha entera otra vez.
      update public.entidades set activa = false, actualizada_at = now()
       where id = v_rep.objeto_id;
    elsif v_rep.tipo_objeto = 'proveedor' then
      update public.proveedores set suspendido = true, actualizado_at = now()
       where id = v_rep.objeto_id;
    elsif v_rep.tipo_objeto = 'resena' then
      delete from public.resenas where id = v_rep.objeto_id;
    end if;
  end if;

  update public.reportes set atendido = true where id = p_reporte_id;
end;
$$;

revoke execute on function public.resolver_reporte(uuid, boolean) from public, anon;
grant  execute on function public.resolver_reporte(uuid, boolean) to authenticated;

-- Comprobar que no queda ninguna:
--   select proname from pg_proc p
--     join pg_namespace n on n.oid = p.pronamespace
--    where n.nspname = 'public'
--      and p.prosrc ~ '(conversaciones|accesos_identidad|\midentidades\M)';
