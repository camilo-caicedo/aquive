-- =====================================================================
-- v2 · Entidades · 2 — lo que encontró la revisión
--
-- Idempotente. Se puede volver a correr.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. La política de administrador estaba muerta
--
-- `revoke all ... from authenticated` más una política no dan acceso: una
-- política **filtra** privilegios, no los concede. Sin `grant select`,
-- PostgREST —que conecta como `authenticated`— devolvía
-- «permission denied for table entidades» para todo el mundo, el
-- administrador incluido. Comprobado con `set local role authenticated`.
--
-- Consecuencia: el panel listaba siempre «No hay entidades», porque el
-- error se descartaba en silencio. O sea que después de crear una ficha no
-- se podía editar, retirar ni borrar — incluida la acción de retirar un
-- dominio secuestrado, que es justo el riesgo que este directorio tiene.
--
-- El patrón correcto ya estaba en el proyecto y lo copié mal: `solicitudes`
-- lleva `revoke` y CERO políticas —nadie la lee, la frontera es la vista—,
-- mientras que `sugerencias_item` lleva política de administrador y NINGÚN
-- revoke. Esta tabla es del segundo tipo.
--
-- `anon` sigue sin ningún privilegio: lo público sale de la vista.
-- ---------------------------------------------------------------------

grant select on public.entidades to authenticated;

-- ---------------------------------------------------------------------
-- 2. El puerto no estaba acotado
--
-- `(:[0-9]{1,5})?` acepta `:99999`, que no es un puerto. `new URL` en
-- TypeScript lo rechaza, así que los dos gemelos discrepaban: una fila con
-- ese puerto pasaba el CHECK, se guardaba, y el filtro de render la
-- descartaba sin decir nada — el botón no aparecía y no había error en
-- ninguna parte.
--
-- Se acota a 1–65535 con alternativas, que es como se escribe un rango
-- numérico en una expresión regular sin hacerla ilegible.
-- ---------------------------------------------------------------------

create or replace function public.enlaces_validos(p_enlaces jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select jsonb_typeof(p_enlaces) = 'array'
     and jsonb_array_length(p_enlaces) <= 6
     and not exists (
       select 1 from jsonb_array_elements(p_enlaces) e
        where jsonb_typeof(e) <> 'object'
           or (select count(*) from jsonb_object_keys(e) k
                where k not in ('etiqueta','url')) > 0
           or e->>'etiqueta' is null
           or e->>'url'      is null
           or char_length(trim(e->>'etiqueta')) not between 2 and 40
           or char_length(e->>'url') not between 12 and 200
           or e->>'url' !~ '^https://[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+(:([1-9][0-9]{0,3}|[1-5][0-9]{4}|6[0-4][0-9]{3}|65[0-4][0-9]{2}|655[0-2][0-9]|6553[0-5]))?(/[!-~]*)?$'
           or e->>'url' ~ '[^ -~]'
           or e->>'url' like '%@%'
           or e->>'url' ~ '[[:space:]<>"'']'
     );
$$;

revoke execute on function public.enlaces_validos(jsonb) from public, anon, authenticated;

comment on function public.enlaces_validos(jsonb) is
  'Gemela de esEnlaceSeguro en src/lib/validacion.ts. Si cambia una, cambia la otra. Lista blanca de https:// — nunca la conviertas en lista negra. El EXECUTE revocado no estorba al CHECK porque todas las rutas de escritura corren como postgres: guardar_entidad y resolver_reporte son security definer suyas, y el editor SQL también. Si algún día se le concede INSERT sobre entidades a otro rol, ese insert fallará con «permission denied for function» en vez del mensaje pensado.';

-- ---------------------------------------------------------------------
-- 3. Por qué `tel:` y `mailto:` quedan fuera, dicho bien
--
-- El comentario anterior lo justificaba con la regla 3 —el contacto no pasa
-- por la plataforma—, y eso no se sostiene: el administrador puede escribir
-- el mismo teléfono dentro del `pie`, que es texto libre y se renderiza tal
-- cual. El control declarado no era el control que existía.
--
-- La razón de verdad es más simple y más fuerte: la lista blanca tiene UN
-- esquema porque cada esquema que se agrega es una superficie más que
-- validar, y `https` es el único que hace falta. El teléfono de una
-- organización no es dato personal de nadie y cabe en el `pie` como texto,
-- que es donde no puede ser un enlace ejecutable.
-- ---------------------------------------------------------------------

comment on column public.entidades.pie is
  'Nota de cierre libre del administrador: horarios, cobertura, aclaraciones. Puede llevar el teléfono de la organización — eso no es dato personal de una persona. No lleva filtro de PII a propósito, a diferencia de la nota de una solicitud, porque quien escribe aquí es el responsable del proyecto y no un usuario.';

-- Comprobar:
--   begin;
--     select set_config('request.jwt.claims','{"sub":"<uuid-admin>","role":"authenticated"}',true);
--     set local role authenticated;
--     select count(*) from public.entidades;   -- debe funcionar
--   rollback;
--   select public.enlaces_validos('[{"etiqueta":"Ir","url":"https://a.org:99999/"}]'::jsonb); -- f
--   select public.enlaces_validos('[{"etiqueta":"Ir","url":"https://a.org:8443/x"}]'::jsonb); -- t
