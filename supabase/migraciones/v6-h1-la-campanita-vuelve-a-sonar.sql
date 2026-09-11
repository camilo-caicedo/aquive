-- =====================================================================
-- v6 · Fase H · 1 — `mis_avisos()` deja de devolver `[]` siempre
--
-- Hallazgo de sesión, 2026-09-10: desde `v6-f3-fuera-el-tablero-de-pedidos.sql`
-- (ADR 0016, al retirar el tablero de pedidos), `mis_avisos()` quedó como
--
--   select '[]'::jsonb;
--
-- — un placeholder que nunca se completó. Y `estado_encabezado()` cuenta
-- avisos más nuevos que `avisos_vistos_at` sobre esa lista, así que la
-- campanita lleva sin mostrar el punto rojo desde entonces, para
-- cualquiera. No es una cobertura floja: está completamente apagada.
--
-- Esta migración la reescribe con cinco eventos reales, cada uno filtrado
-- por `auth.uid()` y por más nuevo que `avisos_vistos_at` de quien llama:
--
--   1. Solicitud aceptada o rechazada — para quien PIDIÓ.
--   2. Servicio confirmado con tu código — para el PRESTADOR. Es el mismo
--      momento que la reseña (`confirmar_y_resenar` hace las dos cosas en
--      una transacción), así que un solo evento cubre las dos.
--   3. Referencia confirmada — para el PRESTADOR.
--   4. Teléfono verificado — para el PRESTADOR.
--   5. Ficha suspendida — para el PRESTADOR.
--
-- `solicitudes_servicio` no tenía ninguna columna de "cuándo cambió de
-- estado" — `revisada_at` es de la cola de moderación de `/admin`, no del
-- momento en que el prestador acepta o rechaza. Se agrega `actualizado_at`
-- solo para eso; `cambiarEstado()` en
-- `src/server/servicios/solicitudes.ts` tiene que escribirla junto con
-- `estado` (queda para el plan de ejecución en `Planes/`, es código de
-- dominio TypeScript, no esquema).
--
-- Las otras cuatro tablas ya tenían el timestamp que hacía falta:
-- `servicios_prestados.confirmado_at`, `referencias.revisada_at`,
-- `proveedores.verificado_at`, `proveedores.actualizado_at`.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

alter table public.solicitudes_servicio
  add column if not exists actualizado_at timestamptz;

-- Las filas que ya existen no tienen forma de saber cuándo cambiaron de
-- estado; se les pone su fecha de creación, que es lo más cerca que hay,
-- y así ninguna aparece como "recién pasada" el día que esto se despliega.
update public.solicitudes_servicio
   set actualizado_at = creada_at
 where actualizado_at is null;

alter table public.solicitudes_servicio
  alter column actualizado_at set default now(),
  alter column actualizado_at set not null;

create or replace function public.mis_avisos()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  with yo as (
    select coalesce(avisos_vistos_at, '-infinity'::timestamptz) as desde
      from public.perfiles
     where id = auth.uid()
  )
  select coalesce(jsonb_agg(x order by (x->>'fecha')::timestamptz desc), '[]'::jsonb)
  from (
    -- 1 · Solicitud aceptada o rechazada, para quien pidió.
    select jsonb_build_object(
      'tipo', case s.estado
                when 'aceptada'  then 'solicitud_aceptada'
                when 'rechazada' then 'solicitud_rechazada'
              end,
      'texto', case s.estado
                 when 'aceptada'  then 'El prestador aceptó tu solicitud.'
                 when 'rechazada' then 'El prestador rechazó tu solicitud.'
               end,
      'fecha', s.actualizado_at,
      'href', '/mis-solicitudes'
    ) as x
    from public.solicitudes_servicio s, yo
    where s.perfil_id = auth.uid()
      and s.estado in ('aceptada', 'rechazada')
      and s.actualizado_at > yo.desde

    union all

    -- 2 · Servicio confirmado con tu código, para el prestador. Mismo
    -- momento que la reseña: confirmar_y_resenar hace las dos cosas juntas.
    select jsonb_build_object(
      'tipo', 'servicio_confirmado',
      'texto', 'Alguien confirmó un servicio con tu código y dejó su reseña.',
      'fecha', sp.confirmado_at,
      'href', '/perfil/resenas'
    )
    from public.servicios_prestados sp
    join public.proveedores pr on pr.id = sp.proveedor_id, yo
    where pr.perfil_id = auth.uid()
      and sp.confirmado_at is not null
      and sp.confirmado_at > yo.desde

    union all

    -- 3 · Referencia confirmada, para el prestador.
    select jsonb_build_object(
      'tipo', 'referencia_confirmada',
      'texto', 'Una persona de la fundación confirmó una de tus referencias.',
      'fecha', r.revisada_at,
      'href', '/perfil/verificaciones'
    )
    from public.referencias r
    join public.proveedores pr on pr.id = r.proveedor_id, yo
    where pr.perfil_id = auth.uid()
      and r.estado = 'confirmada'
      and r.revisada_at is not null
      and r.revisada_at > yo.desde

    union all

    -- 4 · Teléfono verificado, para el prestador.
    select jsonb_build_object(
      'tipo', 'telefono_verificado',
      'texto', 'Verificamos tu teléfono. Tu ficha ya se ve en el directorio.',
      'fecha', pr.verificado_at,
      'href', '/perfil/verificaciones'
    )
    from public.proveedores pr, yo
    where pr.perfil_id = auth.uid()
      and pr.telefono_verificado
      and pr.verificado_at is not null
      and pr.verificado_at > yo.desde

    union all

    -- 5 · Ficha suspendida, para el prestador.
    select jsonb_build_object(
      'tipo', 'ficha_suspendida',
      'texto', 'Un administrador suspendió tu ficha.',
      'fecha', pr.actualizado_at,
      'href', '/servicios/soy-proveedor'
    )
    from public.proveedores pr, yo
    where pr.perfil_id = auth.uid()
      and pr.suspendido
      and pr.actualizado_at > yo.desde
  ) t
$function$;

comment on function public.mis_avisos() is
  'La campanita. Cinco eventos reales, cada uno filtrado por auth.uid() y por más nuevo que avisos_vistos_at de quien llama — no una tabla de notificaciones, una consulta en vivo sobre lo que ya existe. Reescrita 2026-09-10: desde el ADR 0016 devolvía [] siempre, para cualquiera.';

-- Comprobar (con sesión de alguien que tenga una solicitud aceptada/rechazada,
-- un servicio confirmado, una referencia confirmada, el teléfono verificado o
-- la ficha suspendida después de su avisos_vistos_at):
--   select jsonb_array_length(public.mis_avisos());  -- > 0
