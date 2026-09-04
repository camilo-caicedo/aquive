-- =====================================================================
-- v6 · Fase F · 4 — el índice de /admin, después de la versión mínima
--
-- `panel_admin_indice()` quedó rota, no desactualizada. Cuenta filas de
-- `public.solicitudes` y `public.respuestas`, y las dos tablas se fueron
-- con el módulo de insumos en `v6-f1` (ADR 0014). Una función `stable`
-- que consulta una tabla que no existe no devuelve un cero: revienta. Y
-- la llama `/admin` al entrar, así que la pantalla de moderación entera
-- deja de abrir.
--
-- El otro arreglo es más silencioso y por eso peor: el contador de
-- solicitudes de servicio sin revisar filtra por `estado = 'abierta'`, y
-- desde `v6-f2` (ADR 0015) los estados son otros cinco. La consulta no
-- falla; devuelve cero para siempre. Un cero permanente en una cola de
-- moderación se lee como «no hay nada que revisar», que es justo lo que
-- no se puede dejar creer a quien modera.
--
-- Va después de `v6-f2` porque depende de sus estados nuevos.
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
    --
    -- ⚠ `estado = 'pendiente'`, no `'abierta'`: son los estados del ADR
    -- 0015. Una orden ya aceptada no está esperando moderación, y una
    -- rechazada tampoco.
    'solicitudes_servicio_sin_revisar', (
      select count(*) from public.solicitudes_servicio
       where revisada_at is null and estado = 'pendiente' and expira_at > now()),
    'sugerencias', (
      select count(*) from public.sugerencias_item where estado = 'pendiente'),
    -- `catalogo_items` se queda: la usan /registro, /admin/catalogo y el
    -- panel de acopio. No se fue con el módulo de insumos.
    'items_activos', (
      select count(*) from public.catalogo_items where activo),
    'entidades', (select count(*) from public.entidades),
    'entidades_retiradas', (select count(*) from public.entidades where not activa),
    -- Se fueron `solicitudes_abiertas` y `solicitudes_sin_respuestas`:
    -- contaban `public.solicitudes` y `public.respuestas`, que ya no
    -- existen. No se sustituyen por nada, porque no hay nada equivalente
    -- que contar: el tablero de pedidos abiertos desapareció entero.
    'resenas_ocultas', (select count(*) from public.resenas where oculta),
    'zonas_pendientes', (select count(*) from public.zonas where estado = 'propuesta'),
    'fichas_suspendidas', (select count(*) from public.proveedores where suspendido),

    -- Organizaciones
    'organizaciones', (select count(*) from public.organizaciones),
    'organizaciones_inactivas', (select count(*) from public.organizaciones where not activa)
  );
end;
$function$;
