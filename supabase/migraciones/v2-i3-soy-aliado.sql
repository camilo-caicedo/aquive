-- =====================================================================
-- v2 · Arreglo — la pestaña «Mi organización» sale de la pertenencia
--
-- En la Fase D dejé el encabezado preguntando por `perfiles.tipo = 'aliado'`
-- para ahorrar una consulta por carga. El razonamiento era que quien se
-- une a una organización sin perfil previo queda con ese tipo, y que quien
-- ya tenía perfil llegaría por el enlace de la invitación.
--
-- Está mal, y se vio en el primer uso real: la COORDINADORA de la
-- fundación no veía su propio panel, porque su perfil era `ofertador`. Y
-- el camino que lleva ahí es de lo más normal — cualquiera que guarde un
-- contacto en /registro deja de ser `aliado` y pasa a ser `ofertador`.
--
-- Una consulta más por carga es más barata que una persona que no
-- encuentra la pantalla donde tiene que trabajar.
--
-- Incluye a quien está `pendiente` a propósito: esa pantalla explica que
-- su ingreso está por aprobar, y es justo quien más necesita leerla. A
-- quien un coordinador sacó (`inactivo`) no le sale la pestaña; si entra
-- por la URL, la pantalla se lo dice.
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

create or replace function public.soy_aliado()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1
      from public.miembros_organizacion m
      join public.organizaciones o on o.id = m.organizacion_id
     where m.perfil_id = auth.uid()
       and m.estado in ('activo','pendiente')
       and o.activa
  );
$$;

revoke execute on function public.soy_aliado() from public, anon;
grant  execute on function public.soy_aliado() to authenticated;

comment on function public.soy_aliado() is
  'Solo para decidir si el encabezado muestra la pestaña «Mi organización». No autoriza nada: quien decide qué puede hacer un miembro es es_miembro_activo(), y cada RPC lo vuelve a comprobar.';

-- Comprobar:
--   -- Con la sesión de alguien que es miembro activo pero cuyo perfil es
--   -- de tipo `ofertador`: tiene que devolver true.
--   select public.soy_aliado();
