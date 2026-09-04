-- =====================================================================
-- v6 · Fase C · 1 — la cola de imágenes entra en el índice de /admin
--
-- La pantalla `/admin/imagenes` existe y funciona desde el ADR 0003, y
-- **ningún enlace de la aplicación apunta a ella**: cero `href` en todo
-- `src/`, y el índice de administración lista once colas sin incluirla.
--
-- La regla de producto 8 dice que ninguna imagen se publica sin pasar por
-- esa cola. Una cola sin puerta es una cola que nadie atiende: toda imagen
-- subida se quedaba esperando indefinidamente.
--
-- Va en el primer grupo, «Esperando a alguien», y suma al número del
-- escudo: detrás de cada una hay una persona cuya foto no se ve.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

create or replace function public.panel_admin_indice()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $function$
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
    'imagenes', (
      select count(*) from public.imagenes where estado = 'en_cola'),
    'pqr', (
      select count(*) from public.pqr where estado = 'abierta'),

    -- Contenido
    'solicitudes_servicio_sin_revisar', (
      select count(*) from public.solicitudes_servicio
       where revisada_at is null and estado = 'abierta' and expira_at > now()),
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
$function$;

revoke execute on function public.panel_admin_indice() from public, anon;
grant  execute on function public.panel_admin_indice() to authenticated;
