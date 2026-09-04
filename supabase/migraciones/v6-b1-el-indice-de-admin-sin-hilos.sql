-- =====================================================================
-- v6 · Fase B · 1 — el índice de administración deja de leer una tabla
--                    que ya no existe
--
-- El síntoma que se reportó era «en /admin sale 0 entidades y cuando
-- entro hay 2». No era de entidades: salían en cero LOS DIECISIETE
-- contadores, y el número del escudo del encabezado también.
--
-- La causa: `panel_admin_indice()` todavía contaba así
--
--     'hilos_sin_fundacion', (
--       select count(*) from public.conversaciones
--        where estado = 'esperando_aliado'),
--
-- y `conversaciones` la borró el ADR 0007, en
-- `v5-b1-fuera-el-flujo-acompanado.sql`. La función lanzaba
-- «relation "public.conversaciones" does not exist», el cliente recibía
-- `data: null`, y la pantalla pinta `x ?? 0` para cada clave. Un fallo
-- que se disfraza de dato: no hay error en pantalla, hay ceros.
--
-- ⚠ Aquella migración sí reescribió `estado_encabezado()` y
-- `bitacora_accesos()`, que tenían exactamente el mismo problema. Se
-- saltó esta. Lección para la próxima vez que se borre una tabla: buscar
-- el nombre en TODOS los cuerpos de función, no solo en las que se
-- recuerdan.
--
-- Aquí no se añade ningún contador: la cola de solicitudes por revisar
-- llega con su propia columna en `v6-b2`, y una función que cuente una
-- columna que todavía no existe es este mismo error otra vez.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

create or replace function public.panel_admin_indice()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.es_admin(auth.uid()) then
    raise exception 'No autorizado';
  end if;

  return jsonb_build_object(
    -- Esperando a alguien. La suma de este grupo es el número del escudo.
    'matriculas', (
      select count(*) from public.servidores where not verificado),
    'telefonos', (
      select count(*) from public.proveedores
       where not telefono_verificado and not suspendido),
    'reportes', (
      select count(*) from public.reportes where not atendido),

    -- Contenido
    'sugerencias', (
      select count(*) from public.sugerencias_item where estado = 'pendiente'),
    'items_activos', (
      select count(*) from public.catalogo_items where activo),
    'entidades', (select count(*) from public.entidades),
    'entidades_retiradas', (select count(*) from public.entidades where not activa),
    'solicitudes_abiertas', (
      select count(*) from public.solicitudes s
       where public.estado_activo(s.estado) and s.expira_at > now()),
    'solicitudes_sin_respuestas', (
      select count(*) from public.solicitudes s
       where public.estado_activo(s.estado) and s.expira_at > now()
         and not exists (select 1 from public.respuestas r where r.solicitud_id = s.id)),
    'resenas_ocultas', (select count(*) from public.resenas where oculta),
    'zonas_pendientes', (select count(*) from public.zonas where estado = 'propuesta'),
    'fichas_suspendidas', (select count(*) from public.proveedores where suspendido),

    -- Organizaciones
    'organizaciones', (select count(*) from public.organizaciones),
    'organizaciones_inactivas', (select count(*) from public.organizaciones where not activa)
  );
end;
$$;

revoke execute on function public.panel_admin_indice() from public, anon;
grant  execute on function public.panel_admin_indice() to authenticated;

-- Comprobar, con sesión de administrador:
--   select jsonb_pretty(public.panel_admin_indice());
-- Tiene que devolver un objeto, no una excepción, y `entidades` tiene que
-- coincidir con `select count(*) from public.entidades`.
