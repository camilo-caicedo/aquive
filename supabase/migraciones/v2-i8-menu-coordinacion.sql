-- =====================================================================
-- v2 · Arreglo — quien solo ofrece también necesita llegar a su chat
--
-- La pestaña del encabezado salía solo con `soy_aliado()`, o sea solo
-- para el equipo de una fundación. Pero /aliado tiene dos públicos, y el
-- segundo —quien ofreció ayuda en una solicitud acompañada— se quedaba
-- sin puerta: tenía conversaciones abiertas y la única forma de llegar
-- era pasar por la solicitud y de ahí al panel.
--
-- Una sola consulta decide las dos cosas, porque el encabezado corre en
-- CADA carga de CADA página: si se muestra la pestaña, y cómo se llama.
--
--   'organizacion' → es del equipo de una fundación. «Mi organización».
--   'coordinacion' → solo tiene hilos. «Coordinación».
--   null           → no tiene nada que coordinar; no se dibuja nada.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

create or replace function public.mi_menu_coordinacion()
returns text
language sql
security definer
stable
set search_path = ''
as $$
  select case
    when public.soy_aliado() then 'organizacion'
    when exists (select 1 from public.conversaciones c
                  where c.ofertador_id = auth.uid()) then 'coordinacion'
  end;
$$;

revoke execute on function public.mi_menu_coordinacion() from public, anon;
grant  execute on function public.mi_menu_coordinacion() to authenticated;

comment on function public.mi_menu_coordinacion() is
  'Solo para el encabezado: si se dibuja la pestaña de /aliado y con qué nombre. No autoriza nada — cada RPC vuelve a comprobar quién es quién.';
